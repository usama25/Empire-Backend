/* eslint-disable unicorn/prevent-abbreviations */
import * as request from 'supertest';

jest.useFakeTimers({ legacyFakeTimers: true });

it('Health Check', () => {
  return request(server).get('/').expect(200).expect({
    status: 'OK',
  });
});
