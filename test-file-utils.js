console.log("Testing file-utils.js...");
console.log("Node.js version:", process.version);

const path = require("path");
const fs = require("fs").promises;
const { promisify } = require("util");
const glob = promisify(require("glob"));
const fsExtra = require("fs-extra");
const chalk = require("chalk");

// Import the module we want to test
console.log("\n1. Importing file-utils...");
const fileUtils = require("./src/file-utils");
console.log("✅ Successfully imported file-utils");

// Test data
const TEST_DIR = path.join(__dirname, "test-temp");
const TEST_FILE = path.join(TEST_DIR, "test.txt");
const TEST_JS_FILE = path.join(TEST_DIR, "test.js");

async function cleanup() {
  try {
    await fsExtra.remove(TEST_DIR);
  } catch (error) {
    // Ignore errors during cleanup
  }
}

async function setup() {
  await cleanup();
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.writeFile(TEST_FILE, "Test content");
  await fs.writeFile(TEST_JS_FILE, '// Test JS file\nconsole.log("Hello");');
}

async function runTest(name, testFn) {
  console.log(`\n--- Testing: ${name} ---`);
  try {
    await testFn();
    console.log(`✅ ${name}: PASSED`);
    return true;
  } catch (error) {
    console.error(`❌ ${name}: FAILED`);
    console.error("Error:", error.message);
    console.error("Stack:", error.stack.split("\n").slice(0, 3).join("\n    "));
    return false;
  }
}

async function testFileExists() {
  // Test with existing file
  const exists = await fileUtils.fileExists(TEST_FILE);
  if (!exists) throw new Error("File should exist");

  // Test with non-existent file
  const notExists = await fileUtils.fileExists(
    path.join(TEST_DIR, "nonexistent.txt"),
  );
  if (notExists) throw new Error("File should not exist");
}

async function testEnsureDirectoryExists() {
  const testDir = path.join(TEST_DIR, "nested", "dir");
  await fileUtils.ensureDirectoryExists(testDir);

  try {
    const stats = await fs.stat(testDir);
    if (!stats.isDirectory()) {
      throw new Error("Directory was not created");
    }
  } catch (error) {
    throw new Error(`Directory creation failed: ${error.message}`);
  }
}

async function testGetRelativePath() {
  const from = "/path/to/file.js";
  const to = "/path/to/other/file.txt";
  const relative = fileUtils.getRelativePath(from, to);

  if (relative !== "file.txt") {
    throw new Error(`Expected 'file.txt', got '${relative}'`);
  }
}

async function testFormatFileSize() {
  const tests = [
    { bytes: 0, expected: "0 Bytes" },
    { bytes: 500, expected: "500 Bytes" },
    { bytes: 1024, expected: "1 KB" },
    { bytes: 1536, expected: "1.5 KB" },
    { bytes: 1048576, expected: "1 MB" },
  ];

  for (const test of tests) {
    const result = fileUtils.formatFileSize(test.bytes);
    if (result !== test.expected) {
      throw new Error(
        `Expected '${test.expected}' for ${test.bytes} bytes, got '${result}'`,
      );
    }
  }
}

async function testGetFileStats() {
  const stats = await fileUtils.getFileStats(TEST_FILE);

  if (typeof stats.size !== "number") {
    throw new Error("Expected size to be a number");
  }

  if (typeof stats.sizeFormatted !== "string") {
    throw new Error("Expected sizeFormatted to be a string");
  }

  if (!(stats.modified instanceof Date)) {
    throw new Error("Expected modified to be a Date");
  }

  if (stats.isDirectory !== false) {
    throw new Error("Expected isDirectory to be false for a file");
  }
}

async function testFindJsFiles() {
  // Create a test directory with some files
  const testDir = path.join(TEST_DIR, "find-js-files");
  await fs.mkdir(testDir, { recursive: true });

  const testFiles = [
    "file1.js",
    "file2.js",
    "nested/file3.js",
    "ignored/file4.js",
    "not-js.txt",
  ];

  // Create test files
  for (const file of testFiles) {
    const filePath = path.join(testDir, file);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "// Test file");
  }

  // Test finding all JS files
  const allJsFiles = await fileUtils.findJsFiles(path.join(testDir, "**/*.js"));
  if (allJsFiles.length !== 3) {
    throw new Error(`Expected 3 JS files, found ${allJsFiles.length}`);
  }

  // Test with ignore pattern
  const ignoredFiles = await fileUtils.findJsFiles([
    path.join(testDir, "**/*.js"),
    "!" + path.join(testDir, "ignored/**"),
  ]);

  if (ignoredFiles.some((f) => f.includes("ignored"))) {
    throw new Error("Found files in ignored directory");
  }
}

async function runAllTests() {
  try {
    console.log("Setting up test environment...");
    await setup();

    const tests = [
      { name: "fileExists", fn: testFileExists },
      { name: "ensureDirectoryExists", fn: testEnsureDirectoryExists },
      { name: "getRelativePath", fn: testGetRelativePath },
      { name: "formatFileSize", fn: testFormatFileSize },
      { name: "getFileStats", fn: testGetFileStats },
      { name: "findJsFiles", fn: testFindJsFiles },
    ];

    let allPassed = true;
    for (const test of tests) {
      const passed = await runTest(test.name, test.fn);
      allPassed = allPassed && passed;
    }

    console.log("\n--- Test Summary ---");
    if (allPassed) {
      console.log("✅ All tests passed!");
    } else {
      console.log("❌ Some tests failed");
      process.exit(1);
    }
  } catch (error) {
    console.error("Unhandled error in test:", error);
    process.exit(1);
  } finally {
    console.log("\nCleaning up...");
    await cleanup();
  }
}

// Run the tests
runAllTests();
