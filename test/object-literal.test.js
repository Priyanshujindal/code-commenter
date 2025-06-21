const { processFile } = require("../src/processor");
const fs = require("fs/promises");
const path = require("path");

describe("Object Literal Processing", () => {
  const outputDir = path.join(__dirname, "output");
  const originalFilePath = path.join(
    __dirname,
    "../examples/test-object-literal.js",
  );
  const targetFilePath = path.join(outputDir, "test-object-literal.js");

  beforeEach(async () => {
    await fs.mkdir(outputDir, { recursive: true });
    const originalContent = await fs.readFile(originalFilePath, "utf8");
    await fs.writeFile(targetFilePath, originalContent, "utf8");
  });

  afterEach(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  test("should add comments to functions in an object literal", async () => {
    await processFile(targetFilePath);

    const result = await fs.readFile(targetFilePath, "utf8");

    // Check for comment on 'getValuesSum' method
    expect(result).toMatch(
      /\/\*\*\n\s+\* getValuesSum\n\s+\* @param {any} a - Parameter 'a'\n\s+\* @param {any} b - Parameter 'b'/,
    );
    // Check for comment on 'init' arrow function
    expect(result).toMatch(
      /\/\*\*\n\s+\* init\n\s+\* @param {any} config - Parameter 'config'/,
    );
    // Check for comment on 'process' nested arrow function
    expect(result).toMatch(
      /\/\*\*\n\s+\* process\n\s+\* @param {any} data - Parameter 'data'/,
    );
  });
});