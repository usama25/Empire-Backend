import Big from 'big.js';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ClientProxy } from '@nestjs/microservices';
import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
  Logger,
} from '@nestjs/common';

import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { MongooseLudoGameHistoryRepository } from '@lib/fabzen-common/mongoose/repositories/mongoose-ludo-game-history.repository';
import { config } from '@lib/fabzen-common/configuration';
import {
  Games,
  TransporterProviders,
  UserNameProfilePic,
} from '@lib/fabzen-common/types';

import { RoundEndFullResult } from 'apps/ludo-tournament/src/ludo-tournament.types';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { LudoTournamentProvider } from 'apps/ludo-tournament/src/ludo-tournament.provider';
import { TableService } from './table.service';
import { GameTable, GameTableDocument } from '../../model/game-table.schema';
import { LudoGameplayGateway } from '../../ludo-gameplay.gateway';
import {
  TableInfo,
  Player,
  PlayerDetail,
  PlayerStat,
  Table,
  GameStatus,
  GameTypes,
  Event,
  GameAction,
  CanMovePawn,
  PlayerId,
  TableID,
  TournamentID,
  UserID,
  PlayerStatWithUserId,
} from '../../ludo-gameplay.types';
import {
  calculateScore,
  findWinners,
  getCanMovePawns,
} from '../../utils/ludo-gameplay.utils';

@Injectable()
export class CommonService {
  private readonly logger = new Logger(CommonService.name);
  private readonly walletProvider: WalletProvider;
  private readonly ludoTournamentProvider: LudoTournamentProvider;

  constructor(
    @Inject(TransporterProviders.WALLET_SERVICE)
    private walletClient: ClientProxy,
    @Inject(TransporterProviders.LUDO_TOURNAMENT_SERVICE)
    private ludoTournamentClient: ClientProxy,
    @Inject(forwardRef(() => TableService)) private tableService: TableService,
    @Inject(forwardRef(() => LudoGameplayGateway))
    private readonly ludoGameplayGateway: LudoGameplayGateway,
    @InjectModel(GameTable.name)
    public gameTableModel: Model<GameTableDocument>,
    private configService: RemoteConfigService,
    private gameHistoryRepository: MongooseLudoGameHistoryRepository,
    private userRepository: UserRepository,
  ) {
    this.walletProvider = new WalletProvider(this.walletClient);
    this.ludoTournamentProvider = new LudoTournamentProvider(
      this.ludoTournamentClient,
    );
  }

  async createLudoGameHistory(table: Table) {
    const { tableId, gameType, joinFee, players } = table.tableInfo;
    await this.gameHistoryRepository.creatLudoGameHistory({
      tableId,
      gameType,
      joinFee: joinFee as string,
      userIds: players.map(({ userId }) => userId),
      roomSize: players.length,
    });
  }

  async endGame(table: Table, winnerIds: PlayerId[]) {
    const { tableState, tableInfo } = table;
    const { joinFee, gameType, players, tableId } = tableInfo;
    const { readyPlayers, turnNo } = tableState;

    this.logger.debug(`Game Play log ${tableId}: End Game`);

    if (gameType === GameTypes.tournament) {
      return this.endRound(table);
    }

    if (turnNo === 0) {
      return this.tableService.discardGame(table);
    }

    const winners = players.filter((player) =>
      winnerIds.includes(player.playerId),
    );

    const gameTableFromDatabase = await this.gameTableModel.findOne(
      { tableId },
      {
        _id: 0,
        winAmount: 1,
      },
    );

    const totalWinningAmount: string = gameTableFromDatabase?.winAmount || '0';

    const winningAmount = Big(totalWinningAmount)
      .div(winners.length || 1)
      .toString();

    const scores = calculateScore(table);

    await this.gameTableModel.findOneAndUpdate(
      { tableId },
      {
        $set: {
          winner:
            winnerIds.length === 1 ? winnerIds[0] : JSON.stringify(winnerIds),
          winAmount: winningAmount,
          status: GameStatus.completed,
          scores,
        },
      },
    );

    const losers = players
      .filter(
        ({ playerId }) =>
          readyPlayers.includes(playerId) && !winnerIds.includes(playerId),
      )
      .map(({ userId }) => userId);

    await this.gameHistoryRepository.updateLudoGameHistory({
      tableId,
      winningAmount,
      winners,
      losers,
      joinFee: joinFee as string,
    });
    this.walletProvider.creditLudoWinningAmount(
      winners.map(({ userId }) => userId),
      winningAmount,
      tableId,
    );

    const winnerInfo =
      winnerIds.length === 1
        ? { winner: winnerIds[0] }
        : { winners: winnerIds };

    const userIds = players.map(({ userId }) => userId);

    const usersNameAvatar =
      await this.userRepository.getUserNameProfilePicList(userIds);
    const playerResults = players.map(({ userId, playerId }) => {
      const userNameAvatar = usersNameAvatar.find(
        (userNameAvatar) => userNameAvatar.userId === userId,
      ) as UserNameProfilePic;

      const score = scores[playerId];
      const isWinner = winnerIds.includes(playerId);
      return {
        playerId,
        name: userNameAvatar.name,
        avatar: userNameAvatar.avatar,
        totalScore: gameType === GameTypes.furious4 ? (score ?? 0) : 0,
        isWinner,
        winAmount: isWinner ? winningAmount : '0',
      };
    });
    this.ludoGameplayGateway.gameEnded(tableId, {
      winningAmount,
      players: playerResults,
      ...winnerInfo,
    });
    await this.tableService.removeTable(table);
  }

  async endRound(table: Table): Promise<RoundEndFullResult | undefined> {
    const { tableId, roundNo, players, tournamentId } = table.tableInfo;

    if (!(await this.tableService.getTable(tableId))) {
      this.logger.error('Double End Game No Table');
      return;
    }

    const scores = calculateScore(table);
    const winners = findWinners(players, { ...scores }); // clone the score to avoid in-place update
    await this.gameTableModel.findOneAndUpdate(
      { tableId },
      {
        $set: {
          // FIXME: use better schema
          winner: JSON.stringify(winners),
          status: GameStatus.completed,
          scores,
        },
      },
    );

    const roundEndFullResult = {
      tournamentId,
      roundNo,
      roundEndResults: [
        {
          tableId,
          players: players.map(({ playerId, userId }) => ({
            playerId,
            userId,
          })),
          scores,
          winners,
        },
      ],
    } as RoundEndFullResult;

    this.ludoGameplayGateway.roundEnded(tableId, {
      winners,
      roundNo: roundNo as number,
    });

    const roundEndResponse =
      await this.ludoTournamentProvider.endSomeRoundGamesEarlier(
        roundEndFullResult,
      );

    if (Object.keys(roundEndResponse).length > 0) {
      this.ludoGameplayGateway.tournamentFinished(roundEndResponse);
    } else {
      this.ludoGameplayGateway.tournamentFinished({
        finished: false,
        tournamentId,
        responseRecipients: players.map(({ userId }) => userId),
      });
    }

    await this.tableService.removeTable(table);

    return roundEndFullResult;
  }

  /**
   * Get Player Details for displaying on the screen
   */
  async getPlayersDetail(
    players: Player[],
    tableInfo?: TableInfo,
  ): Promise<PlayerDetail[]> {
    const userIds = players.map(({ userId }) => userId);
    const [userDetails, playStats] = await Promise.all([
      this.getUserDetails(userIds),
      this.getPlayStats(userIds),
    ]);
    const playersDetail = {} as Record<string, PlayerDetail>;
    for (const { userId, playerId } of players) {
      const lives = tableInfo?.players.find(
        (player) => player.userId === userId,
      )?.lives;
      playersDetail[userId] = {
        userId,
        playerId,
        lives: lives ?? config.ludoGameplay.initialLives,
      } as PlayerDetail;
    }
    for (const playerInfo of userDetails) {
      playersDetail[playerInfo.userId] = {
        ...playersDetail[playerInfo.userId],
        playerInfo,
        stats: {},
      } as PlayerDetail;
    }
    for (const { userId, won, lost } of playStats as PlayerStatWithUserId[]) {
      playersDetail[userId].stats = {
        won,
        lost,
      } as PlayerStat;
    }

    return Object.values(playersDetail);
  }

  /**
   * Get User Name and Profile Pictures from User Service
   */
  async getUserDetails(userIds: string[]) {
    const result = [];
    for (const userId of userIds) {
      const userDetails = await this.userRepository.getUserGameDetails(
        userId,
        Games.ludo,
      );
      result.push({ ...userDetails, userId: userId });
    }
    return result;
  }

  /**
   * Get Player Stats from Ludo Game Records
   */
  async getPlayStats(userIds: string[]): Promise<PlayerStatWithUserId[]> {
    return await this.userRepository.getLudoPlayStats(userIds);
  }

  async checkWalletBalance(userId: UserID, joinFee: string): Promise<boolean> {
    if (joinFee === '0') {
      return true;
    }

    return await this.walletProvider.checkLudoWalletBalance(userId, joinFee);
  }

  /**
   * joinFee must be debited when the game is about to start:
   */
  async debitJoinFee(tableInfo: TableInfo, readyPlayerIds: PlayerId[]) {
    const { players, joinFee, tableId } = tableInfo;
    const readyPlayers = players.filter(({ playerId }) =>
      readyPlayerIds.includes(playerId),
    );
    for (const { userId } of readyPlayers) {
      const isBalanceEnough = await this.walletProvider.checkLudoWalletBalance(
        userId,
        joinFee as string,
      );
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!isBalanceEnough) {
        throw new BadRequestException(
          `User ${userId} has insufficient wallet balance`,
        );
      }
    }
    const userIds = readyPlayers.map(({ userId }) => userId);
    await this.walletProvider.debitLudoJoinFee(
      userIds,
      joinFee as string,
      tableId,
    );
  }

  // Kick the user out of the tournament
  makeTournamentLoser(tournamentId: TournamentID, userId: UserID) {
    this.ludoTournamentProvider.ignoreTournament(tournamentId, userId);
  }

  async getLastEvent(tableId: TableID): Promise<Event | undefined> {
    let eventName = '';
    let eventPayload: any = {};
    const table = await this.tableService.getTable(tableId);

    if (table) {
      const { tableInfo, tableState } = table;
      const { players, gameType } = tableInfo;
      const { currentTurn, action, timeout, turnNo } = tableState;
      if (gameType !== GameTypes.tournament && turnNo < 1) {
        return;
      }
      eventName = 'next';
      const player = currentTurn;
      const sortedPlayers = players.sort((a, b) =>
        a.playerId.localeCompare(b.playerId),
      );
      let canMovePawns: CanMovePawn[] | undefined;
      const lives = sortedPlayers.map((player) => player.lives);
      if (action === GameAction.movePawn) {
        canMovePawns = getCanMovePawns(tableState);
      }
      eventPayload = {
        tableId,
        player,
        action,
        canMovePawns,
        timeout,
        lives,
      };
    } else {
      // Game finished or discarded
      const {
        gameType,
        winAmount: winningAmount,
        winner,
        status,
        tournamentId,
        roundNo,
        players,
        scores,
      } = (await this.gameTableModel.findOne(
        { tableId },
        {
          _id: 0,
          gameType: 1,
          winAmount: 1,
          winner: 1,
          status: 1,
          tournamentId: 1,
          roundNo: 1,
          players: 1,
          scores: 1,
        },
      )) as GameTableDocument;
      if (status === GameStatus.completed) {
        if (tournamentId) {
          eventName = 'roundFinished';
          eventPayload = {
            tableId,
            winners: JSON.parse(winner) as PlayerId[],
            roundNo,
          };
        } else {
          eventName = 'gameFinished';
          const userIds = players.map(({ userId }) => userId);
          const usersNameAvatar =
            await this.userRepository.getUserNameProfilePicList(userIds);
          const winnerIds = winner.startsWith('[')
            ? JSON.parse(winner)
            : [winner];
          const playerResults = players.map(({ userId, playerId }) => {
            const userNameAvatar = usersNameAvatar.find(
              (userNameAvatar) => userNameAvatar.userId === userId,
            ) as UserNameProfilePic;

            const score = scores[playerId];
            const isWinner = winnerIds.includes(playerId);
            return {
              playerId,
              name: userNameAvatar.name,
              avatar: userNameAvatar.avatar,
              totalScore: gameType === GameTypes.furious4 ? (score ?? 0) : 0,
              isWinner,
              winAmount: isWinner ? winningAmount : '0',
            };
          });
          eventPayload = {
            tableId,
            winner: winner as PlayerId,
            winningAmount,
            players: playerResults,
          };
        }
      } else {
        eventName = 'discardGame';
        eventPayload = {
          tableId,
        };
      }
    }
    return { eventName, eventPayload };
  }
}
