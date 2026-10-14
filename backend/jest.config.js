/** Unit tests need no database; e2e/integration tests use test/global-setup.ts (embedded or TEST_DATABASE_URL Postgres). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '(src|test)/.*\.(spec|e2e-spec)\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json', diagnostics: true }] },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  testTimeout: 60000,
};
