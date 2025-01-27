import {
  MobileNumber,
  Address,
  Device,
  ExternalIds,
  Wallet,
  Stats,
  Referral,
} from '@lib/fabzen-common/types';
import { BuildInfoDto } from '../dtos/user.common.dto';

export class UserEntity {
  constructor(
    public userId: string,
    public username: string,
    public mobileNumber: MobileNumber,
    public avatar: number,
    public wallet: Wallet,
    public referral: Referral,
    public isEmailVerified: boolean,
    public rank: number,
    public stats: Stats,
    public isKycVerified: boolean,
    public kycModifiedCount: number,
    public isAddressValid: boolean,
    public isPlayStoreUser: boolean,
    public name?: string,
    public isProActive?: boolean,
    public externalIds?: ExternalIds,
    public email?: string,
    public ipAddress?: string,
    public address?: Address,
    public device?: Device,
    public build?: BuildInfoDto,
    public signupBonus?: Wallet,
  ) {}
}
