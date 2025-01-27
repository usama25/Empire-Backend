/* istanbul ignore file */

import { SetMetadata } from '@nestjs/common';
import { Role } from '../types';

export const ROLES = 'ROLES';
export const Authorize = (...roles: Role[]) => SetMetadata(ROLES, roles);
