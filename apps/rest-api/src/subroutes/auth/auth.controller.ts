import { Request } from 'express';
import { getClientIp } from '@supercharge/request-ip';
import { Body, Controller, Post, Inject, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';

import { ApiValidatedOkResponse, Public } from '@lib/fabzen-common/decorators';
import { MobileNumber, TransporterProviders } from '@lib/fabzen-common/types';

import { AuthProvider } from 'apps/auth/src/auth.provider';
import {
  InitAuthRequestDto,
  InitAuthResponseDto,
  VerifyAuthRequestDto,
  VerifyAuthResponseDto,
} from './auth.dto';

@ApiBearerAuth()
@ApiTags('Auth')
@Public()
@Controller()
export class AuthHttpController {
  private readonly authProvider: AuthProvider;

  constructor(
    @Inject(TransporterProviders.AUTH_SERVICE) private userClient: ClientProxy,
  ) {
    this.authProvider = new AuthProvider(this.userClient);
  }

  @Post('/init')
  @ApiOperation({ summary: 'Init Auth' })
  @ApiValidatedOkResponse(InitAuthResponseDto)
  async initAuth(@Req() request: Request, @Body() body: InitAuthRequestDto) {
    const ip = getClientIp(request);
    const { countryCode, mobileNo, build } = body;
    const mobileNumber: MobileNumber = {
      countryCode,
      number: mobileNo,
    };
    return await this.authProvider.initAuth({
      ip,
      mobileNumber,
      build,
    });
  }

  @Post('/verify')
  @ApiOperation({ summary: 'Verify Auth' })
  @ApiValidatedOkResponse(VerifyAuthResponseDto)
  async verifyAuth(
    @Req() request: Request,
    @Body() body: VerifyAuthRequestDto,
  ) {
    const { countryCode, mobileNo, otp, device } = body;
    const mobileNumber: MobileNumber = {
      countryCode,
      number: mobileNo,
    };
    const ipAddress = getClientIp(request);
    const verifyData = await this.authProvider.verifyAuth({
      mobileNumber,
      ipAddress,
      otp,
      device,
    });
    return verifyData;
  }
}
