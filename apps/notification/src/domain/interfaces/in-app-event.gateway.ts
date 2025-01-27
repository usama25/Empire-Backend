import { InAppEventIds } from '../../notification.types';

export abstract class InAppEventService {
  abstract sendEvent(
    ids: InAppEventIds,
    eventName: string,
    eventValue: string | undefined,
  ): Promise<void>;
}

export const createMockInAppEventService = (): InAppEventService => ({
  sendEvent: jest.fn(),
});
