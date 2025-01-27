export abstract class IpRegionResolver {
  abstract getStateFromIpAddress(ip: string): Promise<string>;
}

export const createMockIpRegionResolver = (): IpRegionResolver => ({
  getStateFromIpAddress: jest.fn(),
});
