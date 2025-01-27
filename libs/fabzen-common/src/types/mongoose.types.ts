import {
  Document,
  FilterQuery,
  ProjectionType,
  QueryOptions,
  Types,
} from 'mongoose';

export type MongooseQueryOptions<T extends Document> = {
  filter: FilterQuery<T>;
  option: QueryOptions;
  projection: ProjectionType<T>;
};

export type ObjectId = Types.ObjectId;

export type Paginated<T> = {
  items: Array<T>;
  meta: {
    skip: number;
    limit: number;
    totalCount: number;
  };
};
