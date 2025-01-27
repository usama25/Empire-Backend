export abstract class ScheduleService {
  abstract scheduleEndGame(tableId: string, endTime: string): void;
}

export const createMockScheduleService = (): ScheduleService => ({
  scheduleEndGame: jest.fn(),
});
