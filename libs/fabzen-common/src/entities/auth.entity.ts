import { Otp, Role, MobileNumber } from '@lib/fabzen-common/types';
import { BuildInfoDto } from '../dtos/user.common.dto';

export class AuthEntity {
  constructor(
    public mobileNumber: MobileNumber,
    public roles: Role[],
    public build: BuildInfoDto,
    public otp?: Otp,
    public userId?: string,
  ) {}
}
