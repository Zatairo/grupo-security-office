import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      diagnostics: false,
    }],
  },
  collectCoverageFrom: [
    '**/*.service.ts',
    '**/*.controller.ts',
    '**/*.guard.ts',
    '**/common/**/*.guard.ts',
    '**/common/**/*.decorator.ts',
    '!**/__test__/**',
    '!**/node_modules/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

export default config;
