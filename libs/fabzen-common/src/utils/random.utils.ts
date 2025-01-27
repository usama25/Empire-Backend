import { nanoid, customAlphabet } from 'nanoid';
import { config } from '../configuration';
import { testOrderId } from '../jest/stubs';

export function getRandomInteger(min: number, max: number): number {
  return Math.floor(min + (max - min + 1) * Math.random());
}

export function getRandomString(length: number, alphabet?: string): string {
  return alphabet ? customAlphabet(alphabet)(length) : nanoid(length);
}

export function shuffleArray<T>(array: T[]): T[] {
  for (let index = array.length - 1; index > 0; index--) {
    const index_ = Math.floor(Math.random() * (index + 1));
    [array[index], array[index_]] = [array[index_], array[index]];
  }
  return array;
}

export function generateRandomOrderId(): string {
  if (config.isJest) {
    return testOrderId;
  }
  const { orderIdAlphabet } = config.payment;
  return getRandomString(16, orderIdAlphabet);
}
