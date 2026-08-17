module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'lib/mystery/scriptAnalysis.ts',
  ],
  coverageThreshold: {
    './lib/mystery/scriptAnalysis.ts': {
      statements: 90,
      branches: 90,
      functions: 100,
      lines: 90,
    },
  },
};
