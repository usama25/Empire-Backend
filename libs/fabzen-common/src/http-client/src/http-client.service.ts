/* istanbul ignore file */

import { readFileSync } from 'node:fs';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Observable, catchError, firstValueFrom } from 'rxjs';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';

@Injectable()
export class HttpClientService {
  private readonly logger: FbzLogger = new FbzLogger(HttpClientService.name);
  constructor(private readonly httpService: HttpService) {}

  async get<T>(
    url: string,
    config?: AxiosRequestConfig<any> | undefined,
  ): Promise<T> {
    if (this.#isLocalFile(url)) {
      const content = readFileSync(url, {
        encoding: 'utf8',
      });
      return JSON.parse(content) as T;
    } else {
      const responseObservable = this.httpService.get<T>(url, config);
      return this.#getDataFromObservable<T>(responseObservable);
    }
  }

  #isLocalFile(url: string): boolean {
    return !url.startsWith('http') && !url.startsWith('https');
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig<any> | undefined,
  ): Promise<T> {
    const responseObservable = this.httpService.post<T>(url, data, config);
    return this.#getDataFromObservable<T>(responseObservable);
  }

  async #getDataFromObservable<T>(
    observable: Observable<AxiosResponse<T, any>>,
  ): Promise<T> {
    const { data } = await firstValueFrom(
      observable.pipe(
        catchError((error: AxiosError) => {
          this.logger.error(error.response?.data ?? error);
          throw new InternalServerErrorException(error);
        }),
      ),
    );
    return data;
  }
}
