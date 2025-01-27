import { Controller, UseInterceptors } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagePattern } from '@nestjs/microservices';

import { config } from '@lib/fabzen-common/configuration';
import { Environment, TransporterCmds } from '@lib/fabzen-common/types';

import { SecurityUseCases, OtpUseCases } from '../../domain/use-cases';
import {
  InitAuthRequestDto,
  VerifyAuthRequestDto,
} from './dtos/auth.transporter.dto';
import { MessageData } from '@lib/fabzen-common/decorators/';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { UpdateRolesRequestDto } from 'apps/rest-api/src/subroutes/auth/auth.dto';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class AuthTransporterController {
  constructor(
    private readonly securityUseCases: SecurityUseCases,
    private readonly otpUseCases: OtpUseCases,
    private readonly jwtService: JwtService,
  ) {}

  @MessagePattern(TransporterCmds.INIT_AUTH)
  async initAuth(
    @MessageData(InitAuthRequestDto) initAuthRequestDto: InitAuthRequestDto,
  ) {
    const { ip, mobileNumber, build } = initAuthRequestDto;
    if (ip && config.env !== Environment.development) {
      await this.securityUseCases.rejectRestrictedLocation(ip);
    }

    const { expiresAt } = await this.otpUseCases.requestNewOtp(
      mobileNumber,
      build,
    );
    return {
      expiresAt: expiresAt.toISOString(),
    };
  }

  @MessagePattern(TransporterCmds.VERIFY_AUTH)
  async verifyAuth(
    @MessageData(VerifyAuthRequestDto)
    verifyAuthRequestDto: VerifyAuthRequestDto,
  ) {
    const { mobileNumber, ipAddress, otp, device } = verifyAuthRequestDto;
    await this.securityUseCases.rejectBlockedDevice(device);

    const { userId, roles } = await this.otpUseCases.verifyAndUseOtp(
      mobileNumber,
      ipAddress,
      otp,
      device,
    );

    return {
      userId,
      accessToken: this.jwtService.sign({
        userId,
        roles,
      }),
    };
  }

  @MessagePattern(TransporterCmds.UPDATE_ROLES)
  async updateRoles(
    @MessageData(UpdateRolesRequestDto)
    updateRolesRequestDto: UpdateRolesRequestDto,
  ) {
    this.otpUseCases.updateRoles(updateRolesRequestDto);
  }
}
