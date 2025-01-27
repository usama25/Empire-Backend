import { disconnect } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { E2EServiceManager } from '@lib/fabzen-common/jest/e2e-service-manager';

jest.mock('cashfree-sdk');

beforeAll(async () => {
  global.mongodb = await MongoMemoryServer.create();
  global.e2EServiceManager = new E2EServiceManager(mongodb.getUri());
  await global.e2EServiceManager.setupServices();
  global.server = global.e2EServiceManager.getHttpServer();
});

afterEach(async () => {
  await global.e2EServiceManager.authModel.deleteMany({});
  await global.e2EServiceManager.userModel.deleteMany({});
  await global.e2EServiceManager.userCounterModel.deleteMany({});
  await global.e2EServiceManager.paymentModel.deleteMany({});
  await global.e2EServiceManager.transactionModel.deleteMany({});
});

afterAll(async () => {
  await global.e2EServiceManager.cleanup();
  await disconnect();
  await global.mongodb.stop();
});
