module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@locales/(.*)$': '<rootDir>/locales/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  roots: ['<rootDir>'],
};
