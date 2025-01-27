/* istanbul ignore file */

import * as nock from 'nock';
import { MainConfig } from '../remote-config/remote-config.types';

jest.useFakeTimers({ legacyFakeTimers: true });

export enum HttpMethod {
  get = 'get',
  post = 'post',
  put = 'put',
}

export enum NockOption {
  persist = 'persist',
  once = 'once',
}

export function setupNock(
  url: string,
  method: HttpMethod,
  expectedData?: any,
  noWildCard?: boolean,
  expectedCode?: number,
): nock.Interceptor {
  const baseUrl = new URL(url);
  const origin = baseUrl.origin;
  const pathnameRegex = new RegExp(`^${baseUrl.pathname}.*`);
  switch (method) {
    case HttpMethod.get: {
      const nockInterceptor = nock(origin).get(
        noWildCard ? baseUrl.pathname : pathnameRegex,
      );
      nockInterceptor.reply(expectedCode ?? 200, expectedData ?? {});
      return nockInterceptor;
    }
    case HttpMethod.post: {
      const nockInterceptor = nock(origin).post(pathnameRegex);
      nockInterceptor.reply(expectedCode ?? 200, expectedData ?? {});
      return nockInterceptor;
    }
    case HttpMethod.put: {
      const nockInterceptor = nock(origin).put(pathnameRegex);
      nockInterceptor.reply(expectedCode ?? 200, expectedData ?? {});
      return nockInterceptor;
    }
  }
}

export function setupConfigNock(configToStub: MainConfig) {
  setupNock(
    process.env.CONFIG_FILE_URL as string,
    HttpMethod.get,
    configToStub,
  );
  jest.advanceTimersByTime(6 * 1000);
}
