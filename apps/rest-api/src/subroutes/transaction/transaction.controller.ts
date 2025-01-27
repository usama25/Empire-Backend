import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiValidatedOkResponse,
  Authorize,
  UserID,
} from '@lib/fabzen-common/decorators';
import { WalletRepository } from 'apps/wallet/src/domain/interfaces';
import { config } from '@lib/fabzen-common/configuration';
import {
  AdminRefundRequestBody,
  BonusHistoryResponseDto,
} from './transaction.dto';
import { UserRoleGuard } from '../../guards/user-role.guard';
import { Role } from '@lib/fabzen-common/types';

@ApiBearerAuth()
@ApiTags('Transactions')
@Controller()
export class TransactionController {
  constructor(private readonly walletRepository: WalletRepository) {}

  @Get('/bonus/history')
  @ApiOperation({ summary: 'Get Bonus Transaction' })
  @ApiValidatedOkResponse(BonusHistoryResponseDto)
  async getTransactions(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.walletRepository.getBonusHistory({
      userId,
      skip,
      limit,
    });
  }

  @Get('/refund/history')
  @ApiOperation({ summary: 'Get Refund Transaction' })
  @ApiValidatedOkResponse(BonusHistoryResponseDto)
  async getRefundTransactions(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.walletRepository.getRefundHistory({
      userId,
      skip,
      limit,
    });
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Post('/admin-refund')
  @ApiOperation({ summary: 'Admin Refund' })
  async adminRefund(
    @UserID() userId: string,
    @Body() body: AdminRefundRequestBody,
  ) {
    return await this.walletRepository.adminRefund(userId, body);
  }
}
