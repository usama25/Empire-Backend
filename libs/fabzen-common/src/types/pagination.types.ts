export interface PageDto<T> {
  items: T[];
  meta: {
    totalCount: number;
    skip: number;
    count: number;
  };
}

export type PaginationParameters = Partial<{
  sortBy: string;
  sortDir: 1 | -1;
  skip: number;
  limit: number;
  filter: object;
}>;
