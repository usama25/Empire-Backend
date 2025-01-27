export type TournamentInfoForPushNotification = {
  id: string;
  name: string;
  startAt: string;
  users: UserDetailForNotification[];
};

export type UserDetailForNotification = {
  id: string;
  isGlobalBuild: boolean;
};

export type TournamentInfoForSocketNotification = {
  tournamentId: string;
  name: string;
  startAt: string;
  userIds: string[];
};

export type InAppEventIds = {
  pro: string | undefined;
  base: string | undefined;
};
