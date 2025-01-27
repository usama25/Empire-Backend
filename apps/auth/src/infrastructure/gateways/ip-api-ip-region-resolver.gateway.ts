import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { config } from '@lib/fabzen-common/configuration';

import { IpRegionResolver } from '../../domain/interfaces/ip-region-resolver.gateway';

type IpApiServiceResponse = {
  status: 'success' | 'fail';
  query: string;
  message: string;
  region: string;
};

@Injectable()
export class IpApiIpRegionResolver implements IpRegionResolver {
  private readonly logger = new Logger(IpApiIpRegionResolver.name);

  constructor(private readonly httpClientService: HttpClientService) {}

  async getStateFromIpAddress(ip: string): Promise<string> {
    const { baseUrl, apiKey } = config.auth.ipApiService;
    const requestUrl = this.#constructRequestUrl(baseUrl, ip, apiKey);
    const serviceResponse = await this.#requestDataToService(requestUrl);
    const state = serviceResponse.region;
    return state;
  }

  #constructRequestUrl(baseUrl: string, ip: string, apiKey: string): string {
    return `${baseUrl}/${ip}?fields=status,region&key=${apiKey}`;
  }

  async #requestDataToService(
    requestUrl: string,
  ): Promise<IpApiServiceResponse> {
    const response =
      await this.httpClientService.get<IpApiServiceResponse>(requestUrl);
    this.#throwExceptionIfFailed(response);
    return response;
  }

  #throwExceptionIfFailed(response: IpApiServiceResponse) {
    const { status, message, query } = response;
    if (status === 'fail') {
      this.logger.error(`Ip Api Request Failed with following error`);
      this.logger.error({ message });
      this.logger.error(`Queried with ${query}`);
      throw new InternalServerErrorException('Ip Api Request Failed');
    }
  }
}
