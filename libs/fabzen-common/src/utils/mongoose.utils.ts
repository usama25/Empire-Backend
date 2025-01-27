import { Types } from 'mongoose';

export function toObjectId(idString: string): Types.ObjectId {
  return new Types.ObjectId(idString);
}
