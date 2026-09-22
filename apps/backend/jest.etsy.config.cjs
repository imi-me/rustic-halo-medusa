module.exports = {
  transform: { '^.+\\.ts$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' } } }] },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/lib/etsy/__tests__/**/*.spec.ts'],
}
