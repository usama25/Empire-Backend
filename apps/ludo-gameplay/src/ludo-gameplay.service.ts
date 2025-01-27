import * as dayjs from 'dayjs';
import { Model } from 'mongoose';
import { nanoid } from 'nanoid';
import { InjectModel } from '@nestjs/mongoose';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';

import {
  TournamentDTO,
  TournamentStatus,
  RoundEndResult,
} from 'apps/ludo-tournament/src/ludo-tournament.types';
import { shuffleArray } from '@lib/fabzen-common/utils/random.utils';
import { RedisService } from './services/redis/service';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

import { TableService, CommonService } from './services/gameplay';
import { LudoQueueService, WaitingTableQueueService } from './services/queue';
import {
  TableID,
  TournamentID,
  UserID,
  NextAction,
  GameAction,
  GameStatus,
  Table,
  PlayerId,
  GameTypes,
  PlayerDetail,
  Player,
  PlayerInfo,
  MovePawnRequest,
  RollDiceRequest,
  SkipTurnRequest,
  MovePawnResponse,
  LeaveTableRequest,
  ReadyToStartRequest,
  RoundStartEvent,
  JoinTableResponse,
  ReconnectResponse,
  ReconnectTournamentResponse,
  GameTableFullData,
  ReconnectNormalGameResponse,
  TournamentData,
  PlayerStatWithUserId,
  ForceReconnectGameResponse,
  StartRoundEvent,
  WaitingUser,
} from './ludo-gameplay.types';
import { GameTable, GameTableDocument } from './model/game-table.schema';
import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { LudoGameplayGateway } from './ludo-gameplay.gateway';
import {
  calculateScore,
  findWinners,
  getCanMovePawns,
  getPlayerFromUserId,
  getPlayerId,
  getPlayerInfoOrExceptionIfNotCurrentTurn,
  getRoundDuration,
  getTurnTimeout,
} from './utils/ludo-gameplay.utils';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { config } from '@lib/fabzen-common/configuration';
import { MongooseLudoTournamentRepository } from '@lib/fabzen-common/mongoose/repositories/mongoose-ludo-tournament.repository';
import { SchedulerProvider } from 'apps/scheduler/src/scheduler.provider';
import { ClientProxy } from '@nestjs/microservices';
import {
  TransporterProviders,
  UserGameDetails,
  UserNameProfilePic,
} from '@lib/fabzen-common/types';
import { calculateRoundStartTime } from 'apps/ludo-tournament/src/ludo-tournament.utils';
import { LudoTournamentProvider } from 'apps/ludo-tournament/src/ludo-tournament.provider';
import { NotificationProvider } from 'apps/notification/src/notification.provider';
import { SocketGatewayProvider } from 'apps/socket-gateway/src/socket-gateway.provider';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { LudoRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

@Injectable()
export class LudoGameplayService {
  private readonly logger = new Logger(LudoGameplayService.name);
  private readonly schedulerProvider: SchedulerProvider;
  private readonly ludoTournamentProvider: LudoTournamentProvider;
  private readonly notificationProvider: NotificationProvider;
  private readonly socketGatewayProvider: SocketGatewayProvider;

  constructor(
    private readonly tableService: TableService,
    private readonly commonService: CommonService,
    private readonly ludoGameplayGateway: LudoGameplayGateway,
    private readonly transientDBService: RedisTransientDBService,
    private readonly waitingTableQueueService: WaitingTableQueueService,
    private readonly ludoQueueService: LudoQueueService,
    @InjectModel(GameTable.name)
    public gameTableModel: Model<GameTableDocument>,
    private readonly redisService: RedisService,
    private readonly configService: RemoteConfigService,
    private readonly ludoRemoteConfig: LudoRemoteConfigService,
    private readonly ludoTournamentRepository: MongooseLudoTournamentRepository,
    @Inject(TransporterProviders.SCHEDULER_SERVICE)
    private schedulerClient: ClientProxy,
    @Inject(TransporterProviders.LUDO_TOURNAMENT_SERVICE)
    private ludoTournamentClient: ClientProxy,
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
    @Inject(TransporterProviders.SOCKET_GATEWAY_SERVICE)
    private socketGatewayClient: ClientProxy,
    private readonly userRepository: UserRepository,
  ) {
    this.schedulerProvider = new SchedulerProvider(this.schedulerClient);
    this.ludoTournamentProvider = new LudoTournamentProvider(
      this.ludoTournamentClient,
    );
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );
    this.socketGatewayProvider = new SocketGatewayProvider(
      this.socketGatewayClient,
    );
  }

  async connected(userId: UserID): Promise<ReconnectResponse> {
    const [activeTableId, waitingQueueName, userTournamentId] =
      await Promise.all([
        this.transientDBService.getUserActiveTableId(userId),
        this.transientDBService.getUserWaitingQueueName(userId),
        this.transientDBService.getUserTournamentId(userId),
      ]);

    if (waitingQueueName) {
      const waitingUsers = await this.waitingTableQueueService.getWaitingUsers(
        waitingQueueName,
        userId,
      );
      const myWaitingUser = waitingUsers.find(
        (waitingUser) => waitingUser.userDetails.userId === userId,
      ) as WaitingUser;
      const { tableTypeId, userDetails } = myWaitingUser;

      const {
        amount: joinFee,
        maxPlayer: roomSize,
        tableType: gameType,
        winnings,
      } = this.ludoRemoteConfig.getTableInfoByTypeId(tableTypeId);
      const winningAmount = winnings[roomSize - 2];

      let myGroup: WaitingUser[] = [];
      const waitingUsers_ = [...waitingUsers];

      while (waitingUsers.length > 0) {
        const group = waitingUsers_.splice(0, roomSize);
        if (group.some((user) => user.userDetails.userId === userId)) {
          myGroup = group;
          break;
        }
      }
      const timeout = dayjs(myGroup[0].expiry).toISOString();

      let usernames;
      if (gameType === GameTypes.furious4) {
        usernames =
          await this.waitingTableQueueService.getUserNamesWithAvatarOfQueue(
            waitingUsers,
          );
      }
      return {
        isReconnected: true,
        status: GameStatus.waiting,
        gameType,
        tableTypeId,
        waitingInfo: {
          gameType,
          joinFee,
          roomSize,
          timeout,
          usernames,
          winningAmount,
          userDetails,
        },
      };
    }

    if (activeTableId) {
      // The user is part of an ongoing game (either normal game or tournament)
      try {
        const gameTable = await this.gameTableModel
          .findOne(
            {
              tableId: activeTableId,
            },
            {
              _id: 0,
              winner: 1,
              winAmount: 1,
              status: 1,
              tournamentId: 1,
              createdAt: 1,
              tableTypeId: 1,
            },
          )
          .lean();
        if (!gameTable) {
          throw new InternalServerErrorException(
            `Redis-MongoDB inconsistent on table Id ${activeTableId}`,
          );
        }
        const { tournamentId, createdAt, winAmount, tableTypeId } = gameTable;
        if (tournamentId) {
          // The user is playing tournament
          return this.reconnectTournament(
            tournamentId,
            userId,
            false,
            activeTableId,
          );
        } else {
          const table = (await this.transientDBService.getActiveTable(
            activeTableId,
          )) as Table;

          if (!table) {
            return {
              isReconnected: false,
              status: GameStatus.waiting,
              gameType: GameTypes.quick,
              tableId: activeTableId,
            } as ReconnectNormalGameResponse;
          }

          const { tableInfo } = table;
          const {
            action,
            timeout,
            currentTurn,
            lastDiceValues,
            pawnPositions,
            canMovePawns,
            playersDetail,
            myPlayerId,
          } = await this.getGameTableData(table, userId);
          const { gameType, joinFee, players } = tableInfo;
          const myPlayer = getPlayerFromUserId(table, userId);

          if (myPlayer.didLeave) {
            const otherRandomPlayer = players.find(
              (player) => player.userId !== userId,
            ) as PlayerInfo;
            return {
              isReconnected: true,
              status: GameStatus.completed,
              winner: otherRandomPlayer.playerId,
              tableId: activeTableId,
              winningAmount: winAmount,
              gameType,
              roomSize: players.length,
              table: {
                tableId: activeTableId,
                type: gameType,
                myPlayerId: myPlayer.playerId,
                joinFee,
              },
            };
          } else {
            this.logger.debug(
              `Game Play log ${activeTableId}: User ${userId} auto reconnected`,
            );
            let endAt;
            if (gameType === GameTypes.furious4) {
              const duration = this.ludoRemoteConfig.getGameDuration(
                players.length,
              );
              endAt = dayjs(createdAt).add(duration, 'seconds').toISOString();
            }
            return {
              isReconnected: true,
              status: GameStatus.started,
              gameType,
              tableId: activeTableId,
              tableTypeId,
              gameInfo: {
                table: {
                  tableId: activeTableId,
                  type: gameType,
                  players: playersDetail,
                  myPlayerId,
                  winningAmount: winAmount,
                  joinFee,
                  endAt,
                },
                pawnPositions,
                currentTurn,
                canMovePawns,
                action,
                lastDiceValues,
                timeout,
              },
            };
          }
        }
      } catch (error) {
        this.logger.error('Error occured during active table reconnection');
        this.logger.error(error);
        throw error;
      }
    }

    if (userTournamentId) {
      try {
        const reconnecTournamentResponse = await this.reconnectTournament(
          userTournamentId,
          userId,
          false,
        );
        return reconnecTournamentResponse;
      } catch (error) {
        this.logger.error('Error occured during tournament reconnection');
        this.logger.error(error);
        throw error;
      }
    }

    const ongoingGame = await this.gameTableModel
      .findOne(
        {
          status: GameStatus.started,
          'players.userId': userId,
          createdAt: {
            $gt: dayjs().subtract(1, 'hour').toDate(),
          },
        },
        {
          _id: 0,
          tableId: 1,
          tournamentId: 1,
          createdAt: 1,
          winAmount: 1,
          tableTypeId: 1,
        },
      )
      .lean();

    if (ongoingGame) {
      const { tableId, tournamentId, createdAt, winAmount, tableTypeId } =
        ongoingGame;
      if (tournamentId) {
        return this.reconnectTournament(tournamentId, userId, false, tableId);
      } else {
        const table = (await this.transientDBService.getActiveTable(
          tableId,
        )) as Table;
        if (!table) {
          return {
            isReconnected: false,
            status: GameStatus.waiting,
            gameType: GameTypes.quick,
            tableId,
          };
        }
        const { tableInfo } = table;
        const {
          action,
          timeout,
          currentTurn,
          lastDiceValues,
          pawnPositions,
          canMovePawns,
          playersDetail,
          myPlayerId,
        } = await this.getGameTableData(table, userId);
        const { gameType, joinFee } = tableInfo;
        const myPlayer = getPlayerFromUserId(table, userId);
        if (myPlayer.didLeave) {
          return {
            isReconnected: false,
            status: GameStatus.waiting,
            gameType: GameTypes.quick,
            tableId,
          };
        } else {
          this.logger.debug(
            `Game Play log ${tableId}: User ${userId} auto reconnected`,
          );
          let endAt;
          if (gameType === GameTypes.furious4) {
            const duration = this.ludoRemoteConfig.getGameDuration(
              playersDetail.length,
            );
            endAt = dayjs(createdAt).add(duration, 'seconds').toISOString();
          }
          return {
            isReconnected: true,
            status: GameStatus.started,
            gameType,
            tableId,
            tableTypeId,
            gameInfo: {
              table: {
                tableId,
                type: gameType,
                players: playersDetail,
                myPlayerId,
                winningAmount: winAmount,
                joinFee,
                endAt,
              },
              pawnPositions,
              currentTurn,
              canMovePawns,
              action,
              lastDiceValues,
              timeout,
            },
          };
        }
      }
    } else {
      // Check the last game and send tournament data if it is tournament game
      const isUserNotMatched =
        await this.transientDBService.checkIfUserNotMatched(userId);
      const [lastGame] = await this.gameTableModel
        .find(
          {
            status: { $in: [GameStatus.completed, GameStatus.gameDiscarded] },
            'players.userId': userId,
          },
          { _id: 0, tournamentId: 1 },
        )
        .sort({ updatedAt: -1 })
        .limit(1)
        .lean();
      return !isUserNotMatched && lastGame && lastGame.tournamentId
        ? ({
            isReconnected: false,
            status: GameStatus.completed,
            gameType: GameTypes.tournament,
            tournamentData: {},
          } as ReconnectTournamentResponse)
        : ({
            isReconnected: false,
            status: GameStatus.waiting,
            gameType: GameTypes.quick,
            tableId: '',
          } as ReconnectNormalGameResponse);
    }
  }

  async forceReconnect(
    userId: UserID,
    tableId?: TableID,
  ): Promise<ForceReconnectGameResponse | ReconnectTournamentResponse> {
    const discardedTableIdOfUser =
      await this.transientDBService.getDiscardedUser(userId);
    if (discardedTableIdOfUser) {
      return {
        isReconnected: true,
        status: GameStatus.gameDiscarded,
        tableId: discardedTableIdOfUser,
      };
    }
    // eslint-disable-next-line unicorn/no-null
    let tableDocument: GameTableDocument | null = null;
    const isUserNotMatched =
      await this.transientDBService.checkIfUserNotMatched(userId);

    if (tableId) {
      tableDocument = await this.gameTableModel
        .findOne({
          tableId,
        })
        .lean();
    } else {
      if (isUserNotMatched) {
        return {
          isReconnected: false,
          status: GameStatus.waiting,
          gameType: GameTypes.quick,
          tableId: '',
        };
      }
      const [lastGame] = await this.gameTableModel
        .find({
          'players.userId': userId,
        })
        .sort({ updatedAt: -1 })
        .limit(1)
        .lean();
      tableDocument = lastGame;
    }

    if (!tableDocument) {
      throw new NotFoundException(
        `Table ${tableId} not found while force reconnecting`,
      );
    }
    const {
      winner,
      winAmount,
      status,
      players,
      gameType,
      joinFee,
      tableId: tableIdInDocument,
      scores,
    } = tableDocument;
    if (status === GameStatus.gameDiscarded) {
      return {
        isReconnected: true,
        status: GameStatus.gameDiscarded,
        tableId: tableIdInDocument,
      };
    }

    if (status === GameStatus.completed) {
      const myPlayer = players.find(
        (player) => player.userId === userId,
      ) as Player;
      this.logger.debug(
        `Game Play log ${tableIdInDocument}: User ${userId} force reconnecting, status: ${status}`,
      );
      const userIds = players.map(({ userId }) => userId);
      const usersNameAvatar =
        await this.userRepository.getUserNameProfilePicList(userIds);
      const winnerIds = winner.startsWith('[') ? JSON.parse(winner) : [winner];
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
          winAmount: isWinner ? winAmount : '0',
        };
      });
      return {
        isReconnected: true,
        status,
        winner,
        tableId: tableIdInDocument,
        winningAmount: winAmount,
        roomSize: players.length,
        table: {
          tableId: tableIdInDocument,
          type: gameType as GameTypes,
          myPlayerId: myPlayer.playerId,
          joinFee,
        },
        players: playerResults,
      };
    } else {
      const table = (await this.transientDBService.getActiveTable(
        tableId as TableID,
      )) as Table;

      if (!table) {
        return {
          isReconnected: false,
          status: GameStatus.waiting,
          gameType: GameTypes.quick,
          tableId: '',
        };
      }

      const { tableInfo } = table;
      const {
        action,
        timeout,
        currentTurn,
        lastDiceValues,
        pawnPositions,
        canMovePawns,
        playersDetail,
        myPlayerId,
      } = await this.getGameTableData(table, userId);

      const { gameType, joinFee, players } = tableInfo;
      const myPlayer = getPlayerFromUserId(table, userId);

      this.logger.debug(
        `Game Play log ${tableIdInDocument}: User ${userId} force reconnecting, status: ${
          myPlayer.didLeave ? 'Left' : status
        }`,
      );
      if (myPlayer.didLeave) {
        const otherRandomPlayer = players.find(
          (player) => player.userId !== userId,
        ) as PlayerInfo;
        return {
          isReconnected: true,
          status: GameStatus.completed,
          winner: otherRandomPlayer.playerId,
          tableId,
          winningAmount: winAmount,
          gameType,
          roomSize: players.length,
          table: {
            tableId,
            type: gameType as GameTypes,
            myPlayerId: myPlayer.playerId,
            joinFee,
          },
        };
      }

      return {
        isReconnected: true,
        status: GameStatus.started,
        tableId,
        table: {
          tableId,
          type: gameType,
          players: playersDetail,
          myPlayerId,
          winningAmount: winAmount,
          joinFee,
        },
        pawnPositions,
        currentTurn,
        canMovePawns,
        action,
        lastDiceValues,
        timeout,
      };
    }
  }

  async forceReconnectTournament(
    tournamentId: TournamentID,
    userId: UserID,
  ): Promise<ReconnectTournamentResponse> {
    try {
      const reconnectTournamentResponse = await this.reconnectTournament(
        tournamentId,
        userId,
        true,
      );
      return reconnectTournamentResponse;
    } catch (error) {
      this.logger.error(`Error occured during tournament force reconnection`);
      this.logger.error(error);
      return {
        isReconnected: false,
        status: GameStatus.completed,
        gameType: GameTypes.tournament,
      };
    }
  }

  async joinTable(userId: string, tableTypeId: string) {
    const tableInfo = this.ludoRemoteConfig.getTableInfoByTypeId(tableTypeId);
    const { amount: joinFee, tableType: type } = tableInfo;
    if (Number(joinFee) === 0) {
      const availableFreeGameCount =
        await this.userRepository.availableFreeGameCount(userId);
      if (availableFreeGameCount <= 0) {
        throw new BadRequestException(`No Free Game Available`);
      }
    }

    this.logger.debug(`Game Play log joinTable ${tableTypeId} `);
    const enoughBalance = await this.commonService.checkWalletBalance(
      userId,
      joinFee,
    );
    if (!enoughBalance) {
      throw new BadRequestException(`Wallet balance is not enough`);
    }

    await this.transientDBService.setUserNotMatchedKey(userId, false);
    await this.waitingTableQueueService.addToQueue(userId, tableInfo);
    const matchMakingConfig = this.ludoRemoteConfig.getMatchMakingConfig();
    if (
      Number(joinFee) >=
      Number(matchMakingConfig.minimumJoinAmountForNotifications)
    ) {
      const userIds = await this.transientDBService.getBigTableUsers();
      // exclude my userId
      const otherUserIds = userIds.filter((id) => id !== userId);

      if (matchMakingConfig.isPushNotificationsEnabled) {
        await this.#sendMatchMakingPushNotification(
          otherUserIds,
          type,
          joinFee,
        );
      }
      if (matchMakingConfig.isSocketNotificationsEnabled) {
        await this.#sendMatchMakingSocketNotification(
          otherUserIds,
          type,
          joinFee,
        );
      }
    }
  }

  async #sendMatchMakingPushNotification(
    userIds: string[],
    type: GameTypes,
    joinFee: string,
  ) {
    const pnTitle = 'Play Now ‼️';
    const pnContent = `Oh no! You could not find a player. Don't worry. 😊
    Players are now available 🙋 at the ${joinFee} table. 😍
    Tap here to play! ✌️`;
    const deepLink = this.#constructPNDeepLink(type, joinFee);
    await this.notificationProvider.sendMassPushNotifications(
      userIds,
      pnTitle,
      pnContent,
      deepLink,
    );
  }

  async #sendMatchMakingSocketNotification(
    userIds: string[],
    type: GameTypes,
    joinFee: string,
  ) {
    const deepLink = this.#constructPNDeepLink(type, joinFee);
    await this.socketGatewayProvider.sendMatchMakingSocketNotification(
      userIds,
      deepLink,
    );
  }

  #constructPNDeepLink(type: GameTypes, joinFee: string): string {
    let typeComponent = '';
    switch (type) {
      case GameTypes.quick: {
        typeComponent = 'Quick';
        break;
      }

      case GameTypes.classic: {
        typeComponent = 'Classic';
        break;
      }

      case GameTypes.furious4: {
        typeComponent = 'Furious';
        break;
      }
    }
    return `emp://Ludo/Ludo_${typeComponent}/Join${typeComponent}=${joinFee}`;
  }

  async checkIfJoined(userId: UserID): Promise<JoinTableResponse | undefined> {
    this.logger.debug(`Game Play log checkIfJoined ${userId}`);
    const [ongoingTable] = await this.gameTableModel
      .find(
        {
          'players.userId': userId,
          status: GameStatus.started,
          tournamentId: { $exists: false },
        },
        { _id: 0, tableId: 1, createdAt: 1, winAmount: 1 },
      )
      .lean();
    if (!ongoingTable) {
      return;
    }
    const { tableId, createdAt, winAmount } = ongoingTable;
    this.logger.debug(`Game Play log ${tableId}: CheckIfJoined ${userId}`);
    const table = await this.transientDBService.getActiveTable(tableId);

    if (!table) {
      return;
    }
    const { tableInfo } = table;
    const { gameType, players, joinFee } = tableInfo;

    const myPlayer = getPlayerFromUserId(table, userId);
    if (myPlayer.didLeave) {
      return;
    }

    const myPlayerId = myPlayer.playerId;
    const playersDetail = await this.commonService.getPlayersDetail(
      players,
      tableInfo,
    );

    let endAt;
    if (gameType === GameTypes.furious4) {
      const duration = this.ludoRemoteConfig.getGameDuration(
        playersDetail.length,
      );
      endAt = dayjs(createdAt).add(duration, 'minutes').toISOString();
    }

    return {
      tableId,
      type: gameType,
      players: playersDetail,
      joinFee,
      winningAmount: winAmount,
      myPlayerId,
      endAt,
    };
  }

  async startGame(waitingUsers: WaitingUser[]) {
    const tableId = nanoid(12);
    const players = waitingUsers.map((waitingUser, index) => ({
      userId: waitingUser.userDetails.userId,
      playerId: getPlayerId(index + 1),
    }));

    try {
      const tableTypeId = waitingUsers[0].tableTypeId;
      const tableTypeInfo =
        this.ludoRemoteConfig.getTableInfoByTypeId(tableTypeId);
      const { amount: joinFee, tableType: gameType, winnings } = tableTypeInfo;
      const winAmount = winnings[players.length - 2];

      for (const { userId } of players) {
        await this.transientDBService.setUserActiveTableId(userId, tableId);
        await this.transientDBService.setUserNotMatchedKey(userId, false);
        await this.transientDBService.deleteDiscardedUser(userId);
        if (Number(joinFee) === 0) {
          await this.userRepository.updatePlayedFreeGames(userId);
        }
        if (
          Number(joinFee) >=
          Number(
            this.ludoRemoteConfig.getMatchMakingConfig()
              .minimumJoinAmountForNotifications,
          )
        ) {
          await this.transientDBService.deleteBigTableUser(userId);
        }
      }
      await this.tableService.saveGameTable({
        tableId,
        gameType,
        joinFee,
        tableTypeId,
        players,
        winAmount,
      });
      await this.tableService.storeInitialTable({
        tableTypeId,
        gameType,
        tableId,
        players,
        joinFee,
      });

      const table = (await this.transientDBService.getActiveTable(
        tableId,
      )) as Table;

      const { tableInfo } = table;

      const playerDetails = await this.commonService.getPlayersDetail(
        players,
        tableInfo,
      );

      // Discard game if any of the players did not send readyToStart
      this.ludoQueueService.addTimeoutAction(
        tableId,
        GameAction.discardGame,
        1,
        config.ludoGameplay.startTimeout,
      );

      let endAt;
      if (gameType === GameTypes.furious4) {
        const duration = this.ludoRemoteConfig.getGameDuration(
          playerDetails.length,
        );
        endAt = dayjs().add(duration, 'seconds').toISOString();
        this.schedulerProvider.scheduleEndGame(tableId, endAt);
      }
      this.ludoGameplayGateway.startGame({
        tableId,
        type: gameType,
        players: playerDetails,
        joinFee,
        winningAmount: winAmount,
        endAt,
      });
    } catch (error) {
      this.logger.error(
        `Error Occured initializing table ${tableId}: ${error}`,
      );
      this.discardGame(tableId);
    }
  }

  async readyToStart(readyToStartRequest: ReadyToStartRequest) {
    const { tableId, userId } = readyToStartRequest;
    this.logger.debug(`Game Play log ${tableId}: readyToStart ${userId}`);
    const table = await this.tableService.getTable(tableId);
    if (!table) {
      return;
    }
    const { tableState, tableInfo } = table;
    if (tableInfo.gameType === GameTypes.tournament) {
      // If this is tournament game, ignore it
      return;
    }
    if (tableState.turnNo !== 0) {
      // table already started
      return;
    }

    const playerId = getPlayerFromUserId(table, userId).playerId;

    if (!tableState.readyPlayers.includes(playerId)) {
      tableState.readyPlayers.push(playerId);
    }

    const timeout = getTurnTimeout();
    let allReady = false;

    if (tableInfo.players.length === tableState.readyPlayers.length) {
      tableState.turnNo = 1;
      tableState.timeout = timeout;
      allReady = true;
    }

    const tableUpdated = await this.tableService.updateTable(table);
    if (allReady && tableUpdated) {
      // Check if the game is not discarded
      const tableDocument = await this.gameTableModel.findOne(
        { tableId },
        { _id: 0, status: 1 },
      );

      if (tableDocument && tableDocument.status !== GameStatus.gameDiscarded) {
        const sortedPlayers = tableInfo.players.sort((a, b) =>
          a.playerId.localeCompare(b.playerId),
        );
        const lives = sortedPlayers.map((player) => player.lives);

        const nextAction: NextAction = {
          player: tableState.currentTurn,
          action: GameAction.rollDice,
          timeout,
          lives,
        };
        this.ludoGameplayGateway.next(tableId, nextAction);
        this.ludoQueueService.addTimeoutAction(
          tableId,
          GameAction.skipTurn,
          2,
          config.ludoGameplay.turnTime,
        );

        // All players confirmed that they are ready to start
        await this.commonService.createLudoGameHistory(table);
        if (tableInfo.joinFee !== '0') {
          await this.commonService.debitJoinFee(
            tableInfo,
            tableState.readyPlayers,
          );
        }
      }
    }
    if (!tableUpdated) {
      throw new BadRequestException(`Table ${tableId} is discarded`);
    }
  }

  async discardGame(tableId: TableID) {
    const table = await this.tableService.getTable(tableId);
    if (table) {
      this.tableService.discardGame(table);
    }
  }

  async skipTurn({ tableId, userId }: SkipTurnRequest) {
    const table = await this.tableService.getTable(tableId);
    if (!table) {
      return;
    }
    // Check if the user is of current turn
    const currentPlayer = getPlayerInfoOrExceptionIfNotCurrentTurn(
      table,
      userId,
    );
    await this.tableService.skipTurn(table);

    this.logger.debug(
      `Game Play log ${tableId}: Skip Turn ${userId} ${currentPlayer.playerId}`,
    );
  }

  async rollDice(rollDiceRequest: RollDiceRequest) {
    const { tableId, userId } = rollDiceRequest;
    const table = await this.tableService.getTable(tableId);
    if (!table) {
      return;
    }
    const currentPlayer = getPlayerInfoOrExceptionIfNotCurrentTurn(
      table,
      userId,
    );
    const dice = await this.tableService.rollDice(table);
    this.ludoQueueService.addTimeoutAction(
      tableId,
      GameAction.skipTurn,
      table.tableState.turnNo + 1,
      config.ludoGameplay.turnTime,
    );

    this.logger.debug(
      `Game Play log ${tableId}: Roll Dice ${userId} ${currentPlayer.playerId} outcome ${dice}`,
    );
  }

  async movePawn({
    tableId,
    userId,
    pawn,
    dice,
  }: MovePawnRequest): Promise<MovePawnResponse | undefined> {
    const table = await this.tableService.getTable(tableId);
    if (!table) {
      return;
    }
    const currentTurnPlayer = getPlayerInfoOrExceptionIfNotCurrentTurn(
      table,
      userId,
    );

    const movePawnResponse = await this.tableService.movePawn(
      table,
      pawn,
      dice,
    );
    const { winner, movedPawns, nextAction } = movePawnResponse;
    const nextTurnNo = table.tableState.turnNo + 1;

    if (winner) {
      // Winner Declared, End Game
      this.ludoQueueService.addTimeoutAction(
        tableId,
        GameAction.endGame,
        nextTurnNo,
        config.ludoGameplay.movePawnDelay,
        winner,
      );
    } else {
      // Game Not ended
      this.ludoQueueService.addTimeoutAction(
        tableId,
        GameAction.skipTurn,
        nextTurnNo,
        config.ludoGameplay.turnTime,
      );
      if (nextAction) {
        setTimeout(async () => {
          try {
            await this.redisService.aquireLock(tableId);
            const table = await this.tableService.getTable(tableId);
            const currentTurn = table?.tableState.currentTurn;
            if (currentTurn === nextAction.player) {
              this.ludoGameplayGateway.next(tableId, nextAction);
            }
          } finally {
            await this.redisService.releaseLock(tableId);
          }
        }, config.ludoGameplay.movePawnDelay * 1000);
      }
    }

    this.logger.debug(
      `Game Play log ${tableId}: Move Pawn ${userId} ${
        currentTurnPlayer.playerId
      } outcome ${JSON.stringify(movedPawns)}`,
    );

    return movePawnResponse;
  }

  async leaveTable({ tableId, userId }: LeaveTableRequest) {
    this.logger.debug(`Game Play log ${tableId}: Leave Table ${userId}`);
    const table = await this.tableService.getTable(tableId);
    if (!table) {
      return;
    }
    await this.tableService.leaveTable(table, userId);
  }

  async leaveWaitingTable(userId: string) {
    this.logger.debug(`Game Play log leaveWaitingTable ${userId}`);
    const waitingQueueName =
      await this.transientDBService.getUserWaitingQueueName(userId);
    let failed = false;
    if (waitingQueueName) {
      const tableTypeId =
        this.waitingTableQueueService.getTableTypeIdFromQueueName(
          waitingQueueName,
        );
      if (
        await this.waitingTableQueueService.isUserOnQueue(userId, tableTypeId)
      ) {
        await this.waitingTableQueueService.removeFromQueue(
          userId,
          tableTypeId,
        );
      } else {
        failed = true;
      }
    } else {
      this.ludoGameplayGateway.leftWaitingTable([userId]);
    }
    if (failed) {
      this.ludoGameplayGateway.leaveWaitingTableFailed(userId);
    }
  }

  async startRound(roundStartEventData: RoundStartEvent) {
    const { tournamentId, userIds, noPlayersPerGame, startAt } =
      roundStartEventData;

    const [userDetails, playStatsList] = await Promise.all([
      this.commonService.getUserDetails(userIds),
      this.commonService.getPlayStats(userIds),
    ]);

    const shuffledUserIds = shuffleArray<UserID>(userIds);
    userIds.map((userId) =>
      this.transientDBService.setUserTournamentId(userId, tournamentId),
    );

    const startRoundEvents: StartRoundEvent[] = [];
    const promises = [];
    while (shuffledUserIds.length > 0) {
      const userIdsToBeMatched = shuffledUserIds.splice(0, noPlayersPerGame);
      const promise = this.startRoundGame(
        userIdsToBeMatched,
        roundStartEventData,
        userDetails as UserGameDetails[],
        playStatsList,
      ).then((startRoundEvent) => {
        startRoundEvents.push(startRoundEvent);
      });
      promises.push(promise);
    }
    await Promise.all(promises);

    setTimeout(
      () => {
        for (const startRoundEvent of startRoundEvents) {
          this.ludoGameplayGateway.startRound(startRoundEvent);
        }
      },
      dayjs(startAt).diff(dayjs(), 'milliseconds'),
    );
  }

  async startRoundGame(
    userIdsToBeMatched: UserID[],
    roundStartEventData: RoundStartEvent,
    userDetails: UserGameDetails[],
    playStatsList: PlayerStatWithUserId[],
  ): Promise<StartRoundEvent> {
    const {
      tournamentId,
      tournamentName,
      roundNo,
      maxNoPlayers,
      noPlayersPerGame,
      noJoinedPlayers,
      winningPrizes,
      joinFee,
      totalAmount,
      winnerCount,
      totalRounds,
      startAt,
      remainingUsers,
    } = roundStartEventData;
    const tableId = nanoid(12);
    const gameType = GameTypes.tournament;
    const players = userIdsToBeMatched.map((userId, index) => ({
      userId,
      playerId: getPlayerId(index + 1),
    }));
    const roundStartTime = dayjs(startAt).add(
      config.ludoGameplay.tournamentRoundWaitingTime,
      'seconds',
    );
    const firstTurnTimeout = roundStartTime.add(
      config.ludoGameplay.turnTime,
      'seconds',
    );
    try {
      // eslint-disable-next-line unicorn/prefer-ternary
      if (userIdsToBeMatched.length > 1) {
        await Promise.all(
          [
            // delete user not matched key
            ...players.map(({ userId }) =>
              this.transientDBService.setUserNotMatchedKey(userId, false),
            ),

            ...players.map(({ userId }) =>
              this.transientDBService.deleteDiscardedUser(userId),
            ),

            // Store Game Table in DB if more than 1 player
            this.tableService.saveGameTable({
              tableId,
              gameType,
              players,
              tournamentId,
              roundNo,
            }),
            // Store Game Table in Redis
            this.tableService.storeInitialTable({
              gameType,
              tableId,
              players,
              tournamentId,
              roundNo,
              timeout: firstTurnTimeout.toISOString(),
            }),
          ].filter(Boolean),
        );
      } else {
        await this.transientDBService.setPromotedUser(
          tournamentId,
          userIdsToBeMatched[0],
        );
      }

      const playersDetails: PlayerDetail[] = [];
      for (const { userId, playerId } of players) {
        const playerInfo = userDetails.find(
          (userInfo) => userInfo.userId === userId,
        );
        const playStats = playStatsList.find(
          (stats) => stats.userId === userId,
        );
        if (!playerInfo || !playStats) {
          throw new InternalServerErrorException(
            `Can't find detail of user ${userId}`,
          );
        }
        const { won, lost } = playStats;
        playersDetails.push({
          userId,
          playerId,
          playerInfo: playerInfo,
          stats: {
            won,
            lost,
          },
          lives: config.ludoGameplay.initialLives,
        });
      }

      const lives = Array.from({ length: userIdsToBeMatched.length }).fill(
        config.ludoGameplay.initialLives,
      );
      if (userIdsToBeMatched.length > 1) {
        // Start first Roll after Waiting Time
        const remainingTime = roundStartTime.diff(dayjs(), 'seconds');
        this.ludoQueueService.addTimeoutAction(
          tableId,
          GameAction.rollDice,
          1,
          remainingTime,
          {
            player: PlayerId.pl1,
            action: GameAction.rollDice,
            timeout: roundStartTime
              .add(config.ludoGameplay.turnTime, 'seconds')
              .toISOString(),
            lives,
          },
        );
      }

      const { duration, unit } = getRoundDuration(
        userIdsToBeMatched.length === 1
          ? noPlayersPerGame
          : userIdsToBeMatched.length,
      );
      const endAt = roundStartTime
        .add(duration, unit as dayjs.ManipulateType)
        .toISOString();

      // End Table Earlier if the table has less players than noPlayerPerGame
      if (
        userIdsToBeMatched.length > 1 &&
        userIdsToBeMatched.length < noPlayersPerGame
      ) {
        this.schedulerProvider.scheduleEndRound(
          tournamentId,
          roundNo,
          endAt,
          tableId,
        );
      }
      return {
        table: {
          tableId,
          type: GameTypes.tournament,
          players: playersDetails,
        },
        tournamentData: {
          tournamentId,
          tournamentName,
          roundInfo: {
            remainingUsers,
            roundNo,
            totalRounds,
            startAt: roundStartTime.toISOString(),
            endAt,
          },
          maxNoPlayers,
          noPlayersPerGame,
          noJoinedPlayers,
          winningPrizes,
          joinFee,
          totalAmount,
          winnerCount,
        },
      };
    } catch (error) {
      this.logger.error(`Fatal Error Occured during Starting Round: ${error}`);
      // remove user table key
      this.discardGame(tableId);
      throw error;
    }
  }

  async endSomeRoundGamesEarlier(tableId: TableID) {
    const table = await this.tableService.getTable(tableId);
    if (table) {
      this.commonService.endRound(table);
    }
  }

  async endGame(tableId: TableID) {
    const table = await this.tableService.getTable(tableId);
    if (table) {
      const scores = calculateScore(table);
      const winnerIds = findWinners(table.tableInfo.players, { ...scores });
      await this.commonService.endGame(table, winnerIds);
    }
  }

  async endRound(tournamentId: TournamentID, roundNo: number) {
    const roundEndResults: RoundEndResult[] = [];
    const userIds: UserID[] = [];

    const tableDocuments = await this.gameTableModel
      .find(
        { tournamentId, roundNo },
        { _id: 0, players: 1, scores: 1, winner: 1, tableId: 1, status: 1 },
      )
      .lean();

    await Promise.all(
      tableDocuments.map(async (tableDocument) => {
        const { tableId, status } = tableDocument;
        if (status === GameStatus.started) {
          const table = await this.tableService.getTable(tableId);
          if (table) {
            const players = table.tableInfo.players;
            const scores = calculateScore(table);
            const winners = findWinners(players, { ...scores });
            roundEndResults.push({
              tableId,
              players: players.map(({ playerId, userId }) => ({
                playerId,
                userId,
              })),
              winners,
              scores,
            });
            userIds.push(...players.map(({ userId }) => userId));
            this.ludoGameplayGateway.roundEnded(tableId, {
              winners,
              roundNo: roundNo as number,
            });
            await this.tableService.removeTable(table);
          } else {
            const tableDocumentRefetched = (await this.gameTableModel
              .findOne({ tableId })
              .lean()) as GameTableDocument;
            const { players, winner, scores } = tableDocumentRefetched;
            roundEndResults.push({
              tableId,
              players,
              winners: JSON.parse(winner),
              scores,
            });
          }
        } else {
          const { players, winner, scores } = tableDocument;
          roundEndResults.push({
            tableId,
            players,
            winners: JSON.parse(winner),
            scores,
          });
        }
      }),
    );

    const tournament =
      await this.ludoTournamentRepository.getTournament(tournamentId);

    const { totalRounds, currentRoundNo } = tournament as TournamentDTO;

    const roundEndRequest = this.ludoTournamentProvider.endRound(
      tournamentId,
      roundNo,
      roundEndResults,
    );

    if (currentRoundNo < totalRounds) {
      this.ludoGameplayGateway.tournamentFinished({
        finished: false,
        tournamentId,
        responseRecipients: userIds,
      });
    } else {
      const roundEndResponse = await roundEndRequest;
      this.ludoGameplayGateway.tournamentFinished(roundEndResponse);
    }

    const bulkWriteOps: any[] = [];

    for (const { tableId, winners, scores } of roundEndResults) {
      bulkWriteOps.push({
        updateOne: {
          filter: { tableId },
          update: {
            $set: {
              winner: JSON.stringify(winners),
              status: GameStatus.completed,
              scores,
            },
          },
        },
      });
    }

    this.gameTableModel.bulkWrite(bulkWriteOps, {
      ordered: false,
    });
  }

  async getRoundPlayers(
    tournamentId: TournamentID,
    roundNo: number,
    userId: UserID,
  ): Promise<PlayerDetail[]> {
    const table = await this.gameTableModel
      .findOne({
        tournamentId,
        roundNo,
        'players.userId': userId,
      })
      .lean();
    if (!table) {
      return [];
    }

    const { players } = table;
    return this.commonService.getPlayersDetail(players);
  }

  async reconnectTournament(
    tournamentId: TournamentID,
    userId: UserID,
    needEndedInfo: boolean, // for auto reconnection, no reconnection is needed for finished tournaments
    activeTableId?: TableID,
  ): Promise<ReconnectTournamentResponse> {
    const gameType = GameTypes.tournament;
    const userTournamentId =
      await this.transientDBService.getUserTournamentId(userId);
    if (!userTournamentId) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }
    const tournament =
      await this.ludoTournamentRepository.getTournament(userTournamentId);
    const {
      currentRoundNo,
      name: tournamentName,
      winnerCount,
      maxNoPlayers,
      winningPrizes,
      totalAmount,
      noPlayersPerGame,
      totalRounds,
      joinFee,
      noJoinedPlayers,
      status: tournamentStatus,
      remainingUsers,
      startAt: tournamentStartTime,
    } = tournament as TournamentDTO;

    const tournamentData: TournamentData = {
      tournamentId: tournamentId as string,
      tournamentName: tournamentName as string,
      winnerCount,
      maxNoPlayers,
      noJoinedPlayers,
      winningPrizes,
      totalAmount,
      noPlayersPerGame,
      joinFee,
      roundInfo: {
        roundNo: currentRoundNo,
        totalRounds,
        remainingUsers: remainingUsers as number,
        startAt: '', // Will be set
        endAt: '', // Will be set
      },
    };

    if (userTournamentId && tournamentStatus === TournamentStatus.started) {
      // User might try to reconnect before round is fully initialized
      const tableTargetCount =
        (remainingUsers as number) % noPlayersPerGame > 1
          ? Math.ceil((remainingUsers as number) / noPlayersPerGame)
          : Math.floor((remainingUsers as number) / noPlayersPerGame);

      let retryCount = 0;
      while (retryCount < 10) {
        const tableDocumentCount = await this.gameTableModel.countDocuments({
          tournamentId,
          roundNo: currentRoundNo,
        });
        if (tableDocumentCount === tableTargetCount) {
          break;
        }
        // Check again after 500 ms
        await delay(500);
        if (++retryCount === 10) {
          this.logger.warn(
            `Tournament Round Initialization Failed ${tournamentId} ${currentRoundNo} ${tableTargetCount} ${tableDocumentCount}`,
          );
        }
      }
      let tableId = activeTableId;
      if (!tableId) {
        const gameOfUserCurrentRound = await this.gameTableModel
          .findOne(
            {
              tournamentId,
              roundNo: currentRoundNo,
              'players.userId': userId,
            },
            { _id: 0, tableId: 1 },
          )
          .lean();
        tableId = gameOfUserCurrentRound?.tableId;
      }
      if (tableId) {
        const gameTable = (await this.gameTableModel
          .findOne(
            {
              tableId,
            },
            {
              _id: 0,
              players: 1,
              createdAt: 1,
              status: 1,
              winner: 1,
              roundNo: 1,
            },
          )
          .lean()) as GameTableDocument;

        const { status: gameTableStatus, winner, roundNo, players } = gameTable;
        const startAt = dayjs(
          calculateRoundStartTime(
            tournamentStartTime,
            roundNo,
            noPlayersPerGame,
          ),
        )
          .add(config.ludoGameplay.tournamentRoundWaitingTime, 'seconds')
          .toISOString();
        const { duration, unit } = getRoundDuration(players.length);

        const endAt = dayjs(startAt)
          .add(duration, unit as dayjs.ManipulateType)
          .toISOString();

        if (gameTableStatus === GameStatus.started) {
          const table = (await this.transientDBService.getActiveTable(
            tableId,
          )) as Table;

          const { didLeave } = getPlayerFromUserId(table, userId);
          if (didLeave) {
            return {
              isReconnected: false,
              status: GameStatus.completed,
              gameType,
            };
          } else {
            const {
              action,
              timeout,
              currentTurn,
              lastDiceValues,
              pawnPositions,
              canMovePawns,
              playersDetail,
              myPlayerId,
            } = await this.getGameTableData(table, userId);

            const { gameType } = table.tableInfo;

            const isReconnected = true;
            const status = dayjs().isAfter(dayjs(startAt))
              ? GameStatus.started
              : GameStatus.waiting;
            const gameTableData = dayjs().isAfter(dayjs(startAt))
              ? {
                  action,
                  timeout,
                  currentTurn,
                  lastDiceValues,
                  pawnPositions,
                  canMovePawns,
                }
              : undefined;

            tournamentData.roundInfo.startAt = startAt;
            tournamentData.roundInfo.endAt = endAt;
            return {
              isReconnected,
              status,
              gameType,
              gameTableData,
              tournamentData,
              table: {
                type: gameType,
                tableId,
                players: playersDetail,
                myPlayerId,
                joinFee,
              },
            };
          }
        } else {
          const myPlayerId = players.find((player) => player.userId === userId)
            ?.playerId as PlayerId;
          const winners = JSON.parse(winner) as PlayerId[];
          const status = winners.includes(myPlayerId)
            ? GameStatus.waiting
            : GameStatus.completed;

          const playersDetail =
            await this.commonService.getPlayersDetail(players);

          return {
            isReconnected: true,
            status,
            gameType,
            tournamentData,
            table: {
              type: gameType,
              tableId,
              players: playersDetail,
              myPlayerId,
              joinFee,
            },
            roundFinished: {
              tableId,
              winners,
              roundNo,
            },
          };
        }
      } else {
        // The player is promoted without playing or game tables are not fully initialized
        const otherGameOfCurrentRound = await this.gameTableModel
          .findOne(
            {
              tournamentId,
              roundNo: currentRoundNo,
            },
            { _id: 0, createdAt: 1, players: 1 },
          )
          .lean();

        if (!otherGameOfCurrentRound) {
          await delay(100);
          return this.reconnectTournament(
            tournamentId,
            userId,
            needEndedInfo,
            activeTableId,
          );
        }

        const startAt = dayjs(
          calculateRoundStartTime(
            tournamentStartTime,
            currentRoundNo,
            noPlayersPerGame,
          ),
        )
          .add(config.ludoGameplay.tournamentRoundWaitingTime, 'seconds')
          .toISOString();
        const { duration, unit } = getRoundDuration(noPlayersPerGame);

        const endAt = dayjs(startAt)
          .add(duration, unit as dayjs.ManipulateType)
          .toISOString();

        tournamentData.roundInfo.startAt = startAt;
        tournamentData.roundInfo.endAt = endAt;
        const playersDetail = await this.commonService.getPlayersDetail([
          { userId, playerId: PlayerId.pl1 },
        ]);
        return {
          isReconnected: true,
          status: GameStatus.waiting,
          tournamentData,
          gameType,
          table: {
            type: gameType,
            players: playersDetail,
            myPlayerId: PlayerId.pl1,
          },
        } as ReconnectTournamentResponse;
      }
    } else {
      if (
        (!userTournamentId || tournamentStatus === TournamentStatus.ended) &&
        needEndedInfo
      ) {
        const [lastTournamentGame] = await this.gameTableModel
          .find(
            {
              tournamentId,
              'players.userId': userId,
            },
            {
              _id: 0,
              tableId: 1,
              winner: 1,
              createdAt: 1,
              roundNo: 1,
              status: 1,
              players: 1,
            },
          )
          .sort({ roundNo: -1 })
          .limit(1)
          .lean();
        const { tableId, winner, roundNo, status, players } =
          lastTournamentGame;
        const myPlayerId = players.find((player) => player.userId === userId)
          ?.playerId as PlayerId;
        const playersDetail =
          await this.commonService.getPlayersDetail(players);

        let winners = JSON.parse(winner) as PlayerId[];
        if (status === GameStatus.started) {
          const otherPlayer = players.find(
            (player) => player.userId !== userId,
          ) as Player;
          winners = [otherPlayer.playerId];
        }

        const startAt = dayjs(
          calculateRoundStartTime(
            tournamentStartTime,
            roundNo,
            noPlayersPerGame,
          ),
        )
          .add(config.ludoGameplay.tournamentRoundWaitingTime, 'seconds')
          .toISOString();

        const { duration, unit } = getRoundDuration(players.length);

        const endAt = dayjs(startAt)
          .add(duration, unit as dayjs.ManipulateType)
          .toISOString();

        tournamentData.roundInfo.startAt = startAt;
        tournamentData.roundInfo.endAt = endAt;
        return {
          isReconnected: true,
          status: GameStatus.completed,
          gameType,
          tournamentData,
          table: {
            type: GameTypes.tournament,
            tableId,
            players: playersDetail,
            myPlayerId,
          },
          roundFinished: {
            tableId,
            winners,
            roundNo,
          },
        };
      } else {
        return {
          isReconnected: false,
          status: GameStatus.completed,
          gameType,
        };
      }
    }
  }

  async getAllGameTablesData(tableIds: string): Promise<GameTableDocument[]> {
    return this.gameTableModel.find({ tableId: { $in: tableIds } });
  }

  async getGameTableData(
    table: Table,
    userId: UserID,
  ): Promise<GameTableFullData> {
    const { tableState, tableInfo } = table;
    const { players } = tableInfo;
    const { action, timeout, currentTurn, lastDiceValues, pawnPositions } =
      tableState;
    const myPlayerId = getPlayerFromUserId(table, userId).playerId;
    const remainingPlayers = players.filter(({ didLeave }) => !didLeave);
    const playersDetail = await this.commonService.getPlayersDetail(
      remainingPlayers,
      tableInfo,
    );
    const canMovePawns =
      action === GameAction.movePawn ? getCanMovePawns(tableState) : undefined;

    return {
      action,
      timeout,
      currentTurn,
      lastDiceValues,
      pawnPositions,
      canMovePawns,
      playersDetail,
      myPlayerId,
    };
  }

  async getGameData(tableId: string, userId: string) {
    return this.gameTableModel.aggregate([
      {
        $match: {
          tableId,
        },
      },
      {
        $unwind: {
          path: '$players',
        },
      },
      {
        $match: {
          'players.userId': userId,
        },
      },
      {
        $project: {
          _id: 0,
          joinFee: 1,
        },
      },
    ]);
  }

  async getGameStatus(tableId: string) {
    const gameStatus = await this.gameTableModel.findOne({ tableId });
    if (!gameStatus) {
      throw new InternalServerErrorException(`Table not present ${tableId}`);
    }
    return { status: gameStatus.status };
  }

  async getLeftPlayerList(tableId: TableID | undefined): Promise<PlayerId[]> {
    if (tableId) {
      const table = await this.transientDBService.getActiveTable(tableId);
      if (!table) {
        return [];
      }
      const { players } = table.tableInfo;
      return players
        .filter((player) => player.didLeave)
        .map(({ playerId }) => playerId);
    } else {
      return [];
    }
  }
}
