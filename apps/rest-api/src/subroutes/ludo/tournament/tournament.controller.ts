import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiValidatedOkResponse,
  Authorize,
  UserID,
} from '@lib/fabzen-common/decorators';
import { TransporterProviders } from '@lib/fabzen-common/types/microservices.types';

import { UserRoleGuard } from 'apps/rest-api/src/guards/user-role.guard';
import { Role } from '@lib/fabzen-common/types';
import { CreateTournamentDto, UpdateTournamentDto } from './tournament.dto';
import { LudoTournamentProvider } from 'apps/ludo-tournament/src/ludo-tournament.provider';
import { config } from '@lib/fabzen-common/configuration';

@ApiBearerAuth()
@ApiTags('Ludo Tournament')
@Controller()
export class LudoTournamentController {
  private readonly ludoTournamentProvider: LudoTournamentProvider;
  constructor(
    @Inject(TransporterProviders.LUDO_TOURNAMENT_SERVICE)
    private client: ClientProxy,
  ) {
    this.ludoTournamentProvider = new LudoTournamentProvider(this.client);
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Post('/')
  @ApiOperation({ summary: 'Create Tournament' })
  async createTournament(@Body() body: CreateTournamentDto) {
    return await this.ludoTournamentProvider.createTournament(body);
  }

  @Get('/:tournamentId')
  @ApiOperation({ summary: 'Get Tournament By Id' })
  @ApiValidatedOkResponse(CreateTournamentDto)
  async getTournamentById(
    @Param('tournamentId') tournamentId: string,
    @UserID() userId: string,
  ) {
    return await this.ludoTournamentProvider.getTournamentById(
      tournamentId,
      userId,
    );
  }

  @Get('')
  @ApiOperation({ summary: 'Get Tournaments' })
  async getTournaments(
    @Query('skip') skip: number,
    @Query('limit') limit: number,
    @Query('noPlayersPerGame') noPlayersPerGame: number,
    @Query('minJoinFee') minJoinFee: string,
    @Query('maxJoinFee') maxJoinFee: string,
    @Query('winnerCount') winnerCount: string,
    @Query('isActive') isActive: string,
    @Query('joinable') joinable: string,
    @Query('sortBy') sortBy: string,
    // eslint-disable-next-line unicorn/prevent-abbreviations
    @Query('sortDir') sortDir: 1 | -1,
    @Query('featured') featured: string,
    @UserID() userId: string,
  ) {
    // FIXME: use transform pipe or something similar to clear up this mess
    return await this.ludoTournamentProvider.getTournaments({
      skip: Number(skip || config.restApi.defaultParams.skip),
      limit: Number(limit || config.restApi.defaultParams.limit),
      sortBy: sortBy || config.restApi.defaultParams.sortBy,
      sortDir: Number(sortDir || config.restApi.defaultParams.sortDir),
      noPlayersPerGame: Number(noPlayersPerGame),
      minJoinFee,
      maxJoinFee,
      winnerCount,
      userId,
      isActive: isActive ? isActive === 'true' : undefined,
      joinable: joinable ? joinable === 'true' : undefined,
      featured: featured ? featured === 'true' : undefined,
    });
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Put('/:tournamentId')
  @ApiOperation({ summary: 'Update Tournament' })
  @ApiValidatedOkResponse(UpdateTournamentDto)
  async updateTournament(
    @Param('tournamentId') tournamentId: string,
    @Body() body: UpdateTournamentDto,
  ) {
    return await this.ludoTournamentProvider.updateTournament(
      tournamentId,
      body,
    );
  }

  @Post('/:tournamentId/join')
  @ApiOperation({ summary: 'Join Tournament' })
  async joinTournament(
    @Param('tournamentId') tournamentId: string,
    @UserID() userId: string,
  ) {
    return await this.ludoTournamentProvider.joinTournament(
      tournamentId,
      userId,
    );
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Post('/:tournamentId/cancel')
  async forceTerminate(@Param('tournamentId') tournamentId: string) {
    return this.ludoTournamentProvider.cancelTournament(tournamentId);
  }

  @Get('/:tournamentId/leaderboard/:roundNo')
  async getLeaderboard(
    @Query('skip') skip: number,
    @Query('limit') limit: number,
    @Param('tournamentId') tournamentId: string,
    @Param('roundNo') roundNo: string,
    @UserID() userId: string,
  ) {
    return await this.ludoTournamentProvider.getLeaderboard({
      tournamentId,
      roundNo: Number(roundNo),
      userId,
      skip: skip || config.restApi.defaultParams.skip,
      limit: limit || config.restApi.defaultParams.limit,
    });
  }

  @Get('/:tournamentId/rounds/:roundNo')
  async getRoundInfo(
    @Param('tournamentId') tournamentId: string,
    @Param('roundNo') roundNo: number,
    @UserID() userId: string,
  ) {
    return await this.ludoTournamentProvider.getRoundInfo(
      tournamentId,
      roundNo,
      userId,
    );
  }

  @Get('/:tournamentId/finishedRounds')
  async getRoundResult(
    @Param('tournamentId') tournamentId: string,
    @UserID() userId: string,
  ) {
    return await this.ludoTournamentProvider.getFinishedRounds(
      tournamentId,
      userId,
    );
  }

  @Get('/:tournamentId/checkIfFinished')
  async checkIfFinished(
    @Query('round') roundNo: number,
    @Param('tournamentId') tournamentId: string,
    @UserID() userId: string,
  ) {
    return await this.ludoTournamentProvider.checkIfFinished(
      tournamentId,
      roundNo,
      userId,
    );
  }

  @Get('/:tournamentId/userStatus')
  async getUserStatus(
    @Param('tournamentId') tournamentId: string,
    @UserID() userId: string,
  ) {
    return await this.ludoTournamentProvider.getUserStatus(
      tournamentId,
      userId,
    );
  }

  @Get('/:tournamentId/myRank')
  async getMyRank(
    @Param('tournamentId') tournamentId: string,
    @UserID() userId: string,
  ) {
    return await this.ludoTournamentProvider.getMyRank(tournamentId, userId);
  }
}
