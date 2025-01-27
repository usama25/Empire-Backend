import { Role, TransporterProviders } from '@lib/fabzen-common/types';
import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SPGameplayProvider } from 'apps/sp-gameplay/src/sp-gameplay.provider';
import { SLGameProvider } from 'apps/sl-gameplay/src/sl-gameplay.provider';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import {
  CBLiveGamesRequestDto,
  SPLiveGamesRequestDto,
  SLLiveGamesRequestDto,
  RELiveGamesRequestDto,
} from './admin.dto';
import { CbrGameplayProvider } from 'apps/cbr-gameplay/src/cbr-gameplay.provider';
import { Authorize } from '@lib/fabzen-common/decorators';
import { ReGameplayProvider } from 'apps/re-gameplay/src/re-gameplay.provider';

@ApiBearerAuth()
@ApiTags('Admin')
@Controller()
export class AdminController {
  private readonly spGameplayProvider: SPGameplayProvider;
  private readonly cbrGameplayProvider: CbrGameplayProvider;
  private readonly slGameplayProvider: SLGameProvider;
  private readonly reGameplayProvider: ReGameplayProvider;

  constructor(
    @Inject(TransporterProviders.SP_GAMEPLAY_SERVICE)
    private spGameplayClient: ClientProxy,
    @Inject(TransporterProviders.SL_GAMEPLAY_SERVICE)
    private slGameplayClient: ClientProxy,
    @Inject(TransporterProviders.CBR_GAMEPLAY_SERVICE)
    private cbrGameplayClient: ClientProxy,
    @Inject(TransporterProviders.RE_GAMEPLAY_SERVICE)
    private reGameplayClient: ClientProxy,
    private readonly userRepository: UserRepository,
  ) {
    this.spGameplayProvider = new SPGameplayProvider(this.spGameplayClient);
    this.cbrGameplayProvider = new CbrGameplayProvider(this.cbrGameplayClient);
    this.slGameplayProvider = new SLGameProvider(this.slGameplayClient);
    this.reGameplayProvider = new ReGameplayProvider(this.reGameplayClient);
  }

  @Post('/live-games/skillpatti')
  @ApiOperation({ summary: 'Live Games For SP' })
  async getSPGames(
    @Body() body: SPLiveGamesRequestDto,
    @Query('skip') skip: number,
    @Query('count') count: number,
  ) {
    const { userName, tableId, amount } = body;
    let userId;
    if (userName) {
      const user = await this.userRepository.getUserByUserName(userName);
      userId = user?.userId;
    }
    return await this.spGameplayProvider.getGameTables({
      userId,
      tableId,
      amount,
      skip,
      count,
    });
  }

  @Post('/live-games/snakesandladders')
  @ApiOperation({ summary: 'Live Games For SL' })
  async getSLGames(
    @Body() body: SLLiveGamesRequestDto,
    @Query('skip') skip: number,
    @Query('count') count: number,
  ) {
    const { userName, tableId, amount } = body;
    let userId;
    if (userName) {
      const user = await this.userRepository.getUserByUserName(userName);
      userId = user?.userId;
    }
    return await this.slGameplayProvider.getGameTables({
      userId,
      tableId,
      amount,
      skip,
      count,
    });
  }

  @Delete('/live-games/snakesandladders/:tableId')
  @ApiOperation({ summary: 'Clear SL Stuck Table' })
  @Authorize(Role.admin)
  async clearSLStuckTable(@Param('tableId') tableId: string) {
    return await this.slGameplayProvider.clearStuckTable(tableId);
  }

  @Delete('/live-games/skillpatti/:tableId')
  @ApiOperation({ summary: 'Clear SP Stuck Table' })
  @Authorize(Role.admin)
  async clearSPStuckTable(@Param('tableId') tableId: string) {
    return await this.spGameplayProvider.clearStuckTable(tableId);
  }

  @Post('/live-games/rummyempire')
  @ApiOperation({ summary: 'Live Games For RE' })
  async getReGames(
    @Body() body: RELiveGamesRequestDto,
    @Query('skip') skip: number,
    @Query('count') count: number,
  ) {
    const { userName, tableId, amount } = body;
    let userId;
    if (userName) {
      const user = await this.userRepository.getUserByUserName(userName);
      userId = user?.userId;
    }
    return await this.reGameplayProvider.getGameTables({
      userId,
      tableId,
      amount,
      skip,
      count,
    });
  }

  @Delete('/live-games/rummyempire/:tableId')
  @ApiOperation({ summary: 'Clear RE Stuck Table' })
  @Authorize(Role.admin)
  async clearREStuckTable(@Param('tableId') tableId: string) {
    return await this.reGameplayProvider.clearStuckTable(tableId);
  }

  @Post('/live-games/callbreak')
  @ApiOperation({ summary: 'Live Games For CB' })
  async getCbrGames(
    @Body() body: CBLiveGamesRequestDto,
    @Query('skip') skip: number,
    @Query('count') count: number,
  ) {
    const { userName, tableId, amount } = body;
    let userId;
    if (userName) {
      const user = await this.userRepository.getUserByUserName(userName);
      userId = user?.userId;
    }
    return await this.cbrGameplayProvider.getGameTables({
      userId,
      tableId,
      amount,
      skip,
      count,
    });
  }

  @Delete('/live-games/callbreak/:tableId')
  @ApiOperation({ summary: 'Clear CB Stuck Table' })
  @Authorize(Role.admin)
  async clearCBStuckTable(@Param('tableId') tableId: string) {
    return await this.cbrGameplayProvider.clearStuckTable(tableId);
  }
}
