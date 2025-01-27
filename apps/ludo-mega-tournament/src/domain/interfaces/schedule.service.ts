export abstract class ScheduleService {
  abstract scheduleTournamentEnd(tournamentId: string, endTime: string): void;
}

export const createMockScheduleService = (): ScheduleService => ({
  scheduleTournamentEnd: jest.fn(),
});
