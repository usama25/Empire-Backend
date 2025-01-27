import { of, throwError } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { HttpClientService } from './http-client.service';

describe('HttpClientService Unit Tests', () => {
  const testUrl = 'https://test.com';
  describe('SUCCESS', () => {
    const mockResponse = { data: 'mocked data' };
    let httpClientService: HttpClientService;
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HttpClientService,
          {
            provide: HttpService,
            useValue: {
              get: jest.fn(() => of(mockResponse)),
              post: jest.fn(() => of(mockResponse)),
            },
          },
        ],
      }).compile();
      httpClientService = module.get<HttpClientService>(HttpClientService);
    });
    it('GET', async () => {
      const response =
        await httpClientService.get<typeof mockResponse>(testUrl);
      expect(response).toBe(mockResponse.data);
    });
    it('POST', async () => {
      const response =
        await httpClientService.post<typeof mockResponse>(testUrl);
      expect(response).toBe(mockResponse.data);
    });
  });
  describe('FAILURE', () => {
    let httpClientService: HttpClientService;
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HttpClientService,
          {
            provide: HttpService,
            useValue: {
              get: jest.fn(() =>
                throwError(() => new InternalServerErrorException('Error')),
              ),
              post: jest.fn(() =>
                throwError(() => new InternalServerErrorException('Error')),
              ),
            },
          },
        ],
      }).compile();
      httpClientService = module.get<HttpClientService>(HttpClientService);
    });
    it('GET', async () => {
      expect(async () => {
        await httpClientService.get<any>(testUrl);
      }).rejects.toThrow(InternalServerErrorException);
    });
    it('POST', async () => {
      expect(async () => {
        await httpClientService.post<any>(testUrl);
      }).rejects.toThrow(InternalServerErrorException);
    });
  });
});
