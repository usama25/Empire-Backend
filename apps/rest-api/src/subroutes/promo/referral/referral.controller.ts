import { ClientProxy } from '@nestjs/microservices';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { TransporterProviders } from '@lib/fabzen-common/types';
import { ApiValidatedOkResponse, UserID } from '@lib/fabzen-common/decorators';
import { ReferralHistoryResponseDto } from './referral.dto';
import { config } from '@lib/fabzen-common/configuration';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';

@ApiBearerAuth()
@ApiTags('Referral')
@Controller()
export class ReferralController {
  private readonly walletProvider: WalletProvider;
  constructor(
    @Inject(TransporterProviders.WALLET_SERVICE)
    private walletClient: ClientProxy,
  ) {
    this.walletProvider = new WalletProvider(this.walletClient);
  }

  @Get('/history')
  @ApiOperation({ summary: 'Get My User Info' })
  @ApiValidatedOkResponse(ReferralHistoryResponseDto)
  async getMyUser(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.walletProvider.getReferralHistory({
      userId,
      skip,
      limit,
    });
  }
}
