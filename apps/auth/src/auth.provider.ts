import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types';
import {
  InitAuthRequestDto,
  VerifyAuthRequestDto,
  VerifyAuthResponseDto,
} from './infrastructure/controllers/dtos/auth.transporter.dto';
import { UpdateRolesRequestDto } from 'apps/rest-api/src/subroutes/auth/auth.dto';

export class AuthProvider extends MicroserviceProvider {
  async initAuth(initAuthRequest: InitAuthRequestDto) {
    return this._sendRequest<{ expiresAt: string }>(
      TransporterCmds.INIT_AUTH,
      initAuthRequest,
    );
  }

  async verifyAuth(verifyAuthRequestDto: VerifyAuthRequestDto) {
    return this._sendRequest<VerifyAuthResponseDto>(
      TransporterCmds.VERIFY_AUTH,
      verifyAuthRequestDto,
    );
  }

  async updateRoles(updateRolesRequest: UpdateRolesRequestDto) {
    return this._sendRequest<string>(
      TransporterCmds.UPDATE_ROLES,
      updateRolesRequest,
    );
  }
}
