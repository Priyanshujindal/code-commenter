const { execSync } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

// Path to the CLI script
const CLI_PATH = path.join(__dirname, "..", "bin", "code-commenter.js");

// Test file paths
const TEST_DIR = "test/fixtures";
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
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Create a dummy test file
    const testCode = `// Test file for code-commenter

function testFunction(param1, param2) {
  return param1 + param2;
}

const testArrow = (a, b) => a + b;
`;
    await fs.writeFile(TEST_FILE, testCode);
  });

  afterEach(async () => {
    // Cleanup
    await fs.unlink(TEST_FILE);
    try {
      await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors during cleanup
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
    expect(stdout).toContain("@summary TODO: Document what testFunction does");
    expect(stdout).toContain("@summary TODO: Document what testArrow does");
  }, 20000);

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
  }, 20000);

  it("should handle non-existent files gracefully", () => {
    const { status, stderr } = runCLI(["non-existent-file.js"]);
    expect(status).toBe(1);
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
  }, 20000);

  it("should handle files with syntax errors gracefully", () => {
    const badFile = path.join(TEST_DIR, "bad-file.js");
    const fsSync = require("fs");
    fsSync.writeFileSync(badFile, "function ( {");

    const { status, stderr } = runCLI([badFile]);
    expect(status).toBe(1);
    expect(stderr).toContain("Error");
    expect(stderr).toContain("parsing");

    fsSync.unlinkSync(badFile);
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
    }, 20000);
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
  }, 20000);

  it("should respect the --no-todo flag", () => {
    const { status, stdout } = runCLI(["--dry-run", "--no-todo", TEST_FILE]);
    expect(status).toBe(0);
    expect(stdout).not.toContain("TODO");
  });

  it("should use a config file", async () => {
    const configFile = path.join(TEST_DIR, "code-commenter.config.js");
    const config = {
      jsdocTemplate: "/**\n * {name}\n * {params}\n * {returns}\n */",
    };
    await fs.writeFile(configFile, JSON.stringify(config));

    const { status, stdout } = runCLI([
      "--config",
      configFile,
      "--dry-run",
      TEST_FILE,
    ]);
    expect(status).toBe(0);
    expect(stdout).toContain("testFunction"); // Function name from test file

    await fs.unlink(configFile);
  }, 20000);

  it(
    "should handle very large files",
    async () => {
      const largeFile = path.join(TEST_DIR, "large.js");
      // Create a large file with many functions
      let content = "// Large test file\n";
      for (let i = 0; i < 500; i++) {
        content += `function func${i}() {}\n`;
      }
      await fs.writeFile(largeFile, content, "utf8");

      const { status } = runCLI(["--dry-run", largeFile]);
      expect(status).toBe(0);

      await fs.unlink(largeFile);
    },
    30000,
  ); // 30-second timeout

  it("should show the version number", () => {
    const { version } = require("../package.json");
    const { status, stdout } = runCLI(["--version"]);
    expect(status).toBe(0);
    expect(stdout).toContain(version);
  });

  if (os.platform() !== "win32") {
    it("should handle symlinks correctly", async () => {
      const symlink = path.join(TEST_DIR, "symlink-test-file.js");
      try {
        await fs.symlink(TEST_FILE, symlink);
        const { status } = runCLI(["--dry-run", symlink]);
        expect(status).toBe(0);
      } finally {
        await fs.unlink(symlink).catch(() => {});
      }
    });
  }
});
