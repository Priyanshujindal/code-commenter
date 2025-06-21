const { execSync } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

// Path to the CLI script
const CLI_PATH = path.join(__dirname, "..", "bin", "code-commenter.js");

// Test file paths
const TEST_DIR = path.join(__dirname, "fixtures");
const TEST_FILE = path.join(TEST_DIR, "test-file.js");
const TEST_OUTPUT_DIR = path.join(TEST_DIR, "output");

// Helper function to run CLI command
function runCLI(args = [], options = {}) {
  const cmd = ["node", CLI_PATH, ...args].join(" ");
  try {
    const output = execSync(cmd, {
      cwd: options.cwd || process.cwd(),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      status: 0,
      stdout: output,
      stderr: "",
    };
  } catch (error) {
    return {
      status: error.status || 1,
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
    };
  }
}

describe("CLI", () => {
  beforeAll(async () => {
    // Create test directory and file
    await fs.mkdir(TEST_DIR, { recursive: true });

    // Create a test file with some functions
    const testCode = `// Test file for code-commenter

function testFunction(param1, param2) {
  return param1 + param2;
}

const testArrow = (a, b) => a + b;
`;

    await fs.writeFile(TEST_FILE, testCode, "utf8");
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.unlink(TEST_FILE);
      await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  it("should show help when no arguments provided", () => {
    const { status, stdout } = runCLI(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("code-commenter [options] <files...>");
  });

  it("should process a file and add comments", async () => {
    // Run in dry-run mode first
    const { status, stdout } = runCLI(["--dry-run", TEST_FILE]);

    expect(status).toBe(0);
    expect(stdout).toContain("(dry run)");
    expect(stdout).toContain("test-file.js");

    // Check that the file contains the expected comments (in dry-run output)
    expect(stdout).toContain("// TODO: Document what testFunction does");
    expect(stdout).toContain("// TODO: Document what testArrow does");
  });

  it("should create output directory if it does not exist", async () => {
    const outputFile = path.join(TEST_OUTPUT_DIR, "test-file.js");

    // Process file with output directory
    const { status } = runCLI(["--output", TEST_OUTPUT_DIR, TEST_FILE]);

    expect(status).toBe(0);

    // Check that output file was created
    const fileExists = await fs
      .access(outputFile)
      .then(() => true)
      .catch(() => false);

    expect(fileExists).toBe(true);

    // Check that the file contains the expected comments
    const content = await fs.readFile(outputFile, "utf8");
    expect(content).toContain("/**");
    expect(content).toContain("testFunction");
  });

  it("should handle non-existent files gracefully", () => {
    const { status, stderr } = runCLI(["non-existent-file.js"]);
    expect(status).not.toBe(0);
    expect(stderr).toContain("Error");
    expect(stderr).toContain("No files found matching the patterns");
  });

  it("should handle empty files", async () => {
    const emptyFile = path.join(TEST_DIR, "empty.js");
    await fs.writeFile(emptyFile, "", "utf8");

    const { status, stdout } = runCLI(["--dry-run", emptyFile]);
    expect(status).toBe(0);
    expect(stdout).toContain("(no changes needed)");

    await fs.unlink(emptyFile);
  });

  it("should handle files with syntax errors gracefully", async () => {
    const badFile = path.join(TEST_DIR, "syntax-error.js");
    await fs.writeFile(badFile, "function test() {", "utf8");

    const { status, stderr } = runCLI([badFile]);
    expect(status).not.toBe(0);
    expect(stderr).toContain("Error");
    expect(stderr).toContain("parsing");

    await fs.unlink(badFile);
  });

  it("should handle relative paths correctly", async () => {
    const relativePath = path.relative(process.cwd(), TEST_FILE);
    const { status } = runCLI(["--dry-run", relativePath]);
    expect(status).toBe(0);
  });

  if (os.platform() !== "win32") {
    // Skip on Windows due to path issues
    it("should handle home directory paths", async () => {
      const homeFile = path.join(os.homedir(), "test-commenter-file.js");
      try {
        await fs.writeFile(homeFile, "function test() {}", "utf8");
        const { status } = runCLI(["--dry-run", homeFile]);
        expect(status).toBe(0);
      } finally {
        await fs.unlink(homeFile).catch(() => {});
      }
    });
  }

  it("should handle multiple files at once", async () => {
    const file1 = path.join(TEST_DIR, "multi1.js");
    const file2 = path.join(TEST_DIR, "multi2.js");

    await fs.writeFile(file1, "function one() {}", "utf8");
    await fs.writeFile(file2, "function two() {}", "utf8");

    const { status, stdout } = runCLI(["--dry-run", file1, file2]);

    expect(status).toBe(0);
    expect(stdout).toContain("multi1.js");
    expect(stdout).toContain("multi2.js");

    await Promise.all([fs.unlink(file1), fs.unlink(file2)]);
  });

  it("should respect the --no-todo flag", async () => {
    const { status, stdout } = runCLI(["--dry-run", "--no-todo", TEST_FILE]);
    expect(status).toBe(0);
    expect(stdout).not.toContain("TODO");
  });

  it("should handle very large files", async () => {
    const largeFile = path.join(TEST_DIR, "large.js");
    // Create a large file with many functions
    let content = "// Large test file\n";
    for (let i = 0; i < 1000; i++) {
      content += `function func${i}() {}\n`;
    }

    await fs.writeFile(largeFile, content, "utf8");

    const { status } = runCLI(["--dry-run", largeFile]);
    expect(status).toBe(0);

    await fs.unlink(largeFile);
  });
});
