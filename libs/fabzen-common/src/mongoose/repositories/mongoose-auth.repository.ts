import * as dayjs from 'dayjs';
import { Model } from 'mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { MobileNumber, Otp } from '@lib/fabzen-common/types';
import {
  Auth,
  AuthDocument,
} from '@lib/fabzen-common/mongoose/models/auth.schema';
import { AuthEntity } from '@lib/fabzen-common/entities';

import { AuthRepository } from 'apps/auth/src/domain/interfaces';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';
import { UpdateRolesRequestDto } from 'apps/rest-api/src/subroutes/auth/auth.dto';

@Injectable()
export class MongooseAuthRepository implements AuthRepository {
  constructor(
    @InjectModel(Auth.name)
    public authModel: Model<AuthDocument>,
  ) {}

  async getAuthByMobileNumber(
    mobileNumber: MobileNumber,
  ): Promise<AuthEntity | undefined> {
    const authDocument =
      await this.authModel.findById<AuthDocument>(mobileNumber);

    return authDocument
      ? this.#convertDocumentToEntity(authDocument)
      : undefined;
  }

  async updateOtp(mobileNumber: MobileNumber, otp: Otp, build: BuildInfoDto) {
    await this.authModel.findByIdAndUpdate(mobileNumber, {
      $set: {
        otp,
        build,
      },
    });
  }

  async createAuth(authEntity: AuthEntity) {
    const authDocument = this.#convertEntityToDocument(authEntity);
    await authDocument.save();
  }

  async attachUserId(
    mobileNumber: MobileNumber,
    userId: string,
  ): Promise<void> {
    await this.authModel.findByIdAndUpdate(mobileNumber, {
      $set: {
        userId: toObjectId(userId),
      },
    });
  }

  #convertEntityToDocument(authEntity: AuthEntity): AuthDocument {
    const { mobileNumber, roles, otp, userId, build } = authEntity;
    return new this.authModel({
      _id: mobileNumber,
      roles,
      otp,
      userId,
      build,
    });
  }

  #convertDocumentToEntity(authDocument: AuthDocument): AuthEntity {
    const { _id: mobileNumber, roles, otp, userId, build } = authDocument;
    if (otp) {
      otp.lastSentAt = dayjs(otp.lastSentAt);
      otp.expiresAt = dayjs(otp.expiresAt);
    }

    const authEntity = new AuthEntity(
      mobileNumber,
      roles,
      build,
      otp,
      userId?.toString(),
    );

    return authEntity;
  }

  async updateRoles(body: UpdateRolesRequestDto): Promise<void> {
    const { userId, roles } = body;
    const user = await this.authModel.findOne({ userId: toObjectId(userId) });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.authModel.updateOne({ userId: toObjectId(userId) }, { roles });
  }
}
