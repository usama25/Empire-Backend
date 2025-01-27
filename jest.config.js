module.exports = {
  projects: ['.', 'apps/rest-api/test/jest-e2e.json'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/.pnpm/(?!(nanoid)@)'],
  collectCoverageFrom: ['apps/**/*.(t|j)s', 'libs/**/*.(t|j)s'],
  // coveragePathIgnorePatterns: [".module.ts", "main.ts", "test"],
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: [
    '.module.ts',
    'main.ts',
    'test',
    'configuration.ts',
    '<rootDir>/apps/socket-gateway/',
    '<rootDir>/apps/sp-gameplay/',
    '<rootDir>/apps/cbr-gameplay/',
    '<rootDir>/apps/ludo-gameplay/',
    '<rootDir>/apps/ludo-tournament/',
    '<rootDir>/apps/scheduler/',
    '<rootDir>/libs/fabzen-common/src/filters/',
    '<rootDir>/libs/fabzen-common/src/guards/',
    '<rootDir>/libs/fabzen-common/src/pipes/',
    '<rootDir>/libs/fabzen-common/src/utils/',
    '<rootDir>/libs/fabzen-common/src/async-api/validator/',
    '<rootDir>/libs/fabzen-common/src/decorators/',
  ],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/', '<rootDir>/libs/'],
  moduleNameMapper: {
    '^@lib/fabzen-common(|/.*)$': '<rootDir>/libs/fabzen-common/src/$1',
    '^apps(|/.*)$': '<rootDir>/apps/$1',
  },
};
