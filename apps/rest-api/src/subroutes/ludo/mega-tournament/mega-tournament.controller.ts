import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
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
import { Role } from '@lib/fabzen-common/types';

import { UserRoleGuard } from 'apps/rest-api/src/guards/user-role.guard';
import {
  CancelLudoMegaTournamentDto,
  CreateLudoMegaTournamentDto,
  LudoMegaTournamentDto,
} from './mega-tournament.dto';
import { LudoMegaTournamentProvider } from 'apps/ludo-mega-tournament/src/ludo-mega-tournament.provider';
import { config } from '@lib/fabzen-common/configuration';

@ApiBearerAuth()
@ApiTags('Ludo Mega Tournament')
@Controller()
export class LudoMegaTournamentController {
  private readonly ludoMegaTournamentProvider: LudoMegaTournamentProvider;
  constructor(
    @Inject(TransporterProviders.LUDO_MEGA_TOURNAMENT_SERVICE)
    private client: ClientProxy,
  ) {
    this.ludoMegaTournamentProvider = new LudoMegaTournamentProvider(
      this.client,
    );
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Post('/')
  @ApiOperation({ summary: 'Create Mega Tournament' })
  async createTournament(@Body() body: CreateLudoMegaTournamentDto) {
    return await this.ludoMegaTournamentProvider.createTournament(body);
  }

  @Get('/:tournamentId')
  @ApiOperation({ summary: 'Get Mega Tournament By Id' })
  @ApiValidatedOkResponse(LudoMegaTournamentDto)
  async getTournamentById(
    @Param('tournamentId') tournamentId: string,
    @UserID() userId: string,
  ) {
    return await this.ludoMegaTournamentProvider.getTournamentById(
      tournamentId,
      userId,
    );
  }

  @Get('')
  @ApiOperation({ summary: 'Get Mega Tournaments' })
  async getTournaments(
    @Query('skip') skip: number,
    @Query('limit') limit: number,
    @Query('isActive') isActive: string,
    @Query('minJoinFee') minJoinFee: string,
    @Query('maxJoinFee') maxJoinFee: string,
    @Query('winnerCount') winnerCount: string,
    @Query('sortBy') sortBy: string,
    // eslint-disable-next-line unicorn/prevent-abbreviations
    @Query('sortDir') sortDir: 1 | -1,
    @UserID() userId: string,
  ) {
    return await this.ludoMegaTournamentProvider.getTournaments({
      skip: Number(skip || config.restApi.defaultParams.skip),
      limit: Number(limit || config.restApi.defaultParams.limit),
      sortBy: sortBy || config.restApi.defaultParams.sortBy,
      sortDir: Number(sortDir || config.restApi.defaultParams.sortDir),
      userId,
      isActive: isActive ? isActive === 'true' : undefined,
      minJoinFee,
      maxJoinFee,
      winnerCount,
    });
  }

  @Get('/:tournamentId/leaderboard/')
  async getLeaderboard(
    @Query('skip') skip: number,
    @Query('limit') limit: number,
    @Param('tournamentId') tournamentId: string,
    @UserID() userId: string,
  ) {
    return await this.ludoMegaTournamentProvider.getLeaderboard({
      tournamentId,
      userId,
      skip: Number(skip || config.restApi.defaultParams.skip),
      limit: Number(limit || config.restApi.defaultParams.limit),
    });
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Post('/:tournamentId/cancel')
  @ApiOperation({ summary: 'Cancel Mega Tournament' })
  async cencelTournament(
    @Param('tournamentId') tournamentId: string,
    @Body() { reason }: CancelLudoMegaTournamentDto,
  ) {
    return await this.ludoMegaTournamentProvider.cancelTournament(
      tournamentId,
      reason,
    );
  }
}
