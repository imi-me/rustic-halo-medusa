/**
 * Focused unit-test setup for the disabled-by-default MarketSuite route.
 * It keeps this boundary test runnable without loading Medusa's full test
 * configuration or requiring a database.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: "node",
  modulePathIgnorePatterns: ["<rootDir>/.medusa/server"],
  transform: {
    "^.+\\.tsx?$": ["@swc/jest", {
      jsc: { parser: { syntax: "typescript", tsx: false } },
    }],
  },
  moduleNameMapper: {
    "^@medusajs/framework/utils$": "<rootDir>/src/api/integrations/marketsuite/inventory/__tests__/framework-utils.cjs",
  },
}
