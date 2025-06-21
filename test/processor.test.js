const fs = require("fs/promises");
const path = require("path");
const { processFile, hasComment } = require("../src/processor");

// Mock file system
jest.mock("fs/promises");

// Mock glob
jest.mock("glob", () => ({
  glob: jest.fn().mockResolvedValue(["test.js"]),
}));

describe("Processor (New Implementation)", () => {
  const testFile = "test.js";
  const testCode = `
function add(a, b) {
  return a + b;
}

const subtract = (a, b) => a - b;

class Calculator {
  multiply(a, b) {
    return a * b;
  }
}`;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock file reading
    fs.readFile.mockResolvedValue(testCode);

    // Mock file writing
    fs.writeFile.mockResolvedValue();

    // Mock directory check
    fs.stat = jest.fn().mockImplementation((path) => {
      if (path.includes("output")) {
        return Promise.reject({ code: "ENOENT" });
      }
      return Promise.resolve({ isDirectory: () => true });
    });

    // Mock mkdir
    fs.mkdir = jest.fn().mockResolvedValue(undefined);
  });

  describe("processFile", () => {
    it("should process a file and add comments", async () => {
      console.log(
        "DEBUG: testCode used for add comment test:",
        JSON.stringify(testCode),
      );
      const result = await processFile(testFile);

      expect(result).toEqual({
        commentsAdded: expect.any(Number),
        skipped: false,
        filePath: testFile,
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        testFile,
        expect.stringContaining("* add"),
        "utf8",
      );
    });

    it("should handle dry run mode", async () => {
      const result = await processFile(testFile, { dryRun: true });

      expect(result).toEqual({
        commentsAdded: expect.any(Number),
        skipped: false,
        filePath: testFile,
      });

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should handle output directory", async () => {
      const outputDir = "output";
      const result = await processFile(testFile, { output: outputDir });

      expect(result).toEqual({
        commentsAdded: expect.any(Number),
        skipped: false,
        filePath: path.join(outputDir, "test.js"),
      });

      expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
    });

    it("should skip files with existing comments", async () => {
      const commentedCode = `/**
 * Add two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}`;
      console.log(
        "DEBUG: commentedCode used for skip test:",
        JSON.stringify(commentedCode),
      );
      fs.readFile.mockResolvedValueOnce(commentedCode);

      const result = await processFile(testFile);

      expect(result).toEqual(
        expect.objectContaining({
          commentsAdded: 0,
          skipped: true,
        }),
      );

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("hasComment", () => {
    it("should detect single-line comments", () => {
      const code = "// Comment\nfunction test() {}";
      const node = { start: 10, loc: { start: { line: 2 } } };
      expect(hasComment(node, code)).toBe(true);
    });

    it("should detect multi-line comments", () => {
      const code = "/*\n * Comment\n */\nfunction test() {}";
      const node = { start: 20, loc: { start: { line: 4 } } };
      expect(hasComment(node, code)).toBe(true);
    });

    it("should return false for nodes without comments", () => {
      const code = "\n\nfunction test() {}";
      const node = { start: 2, loc: { start: { line: 3 } } };
      expect(hasComment(node, code)).toBe(false);
    });
  });
});
