#!/usr/bin/env node

"use strict";

const { program } = require("commander");
const { processFiles } = require("../src/processor");
const path = require("path");
const fs = require("fs/promises");
const { version } = require("../package.json");
const { execSync } = require("child_process");

program
  .name("code-commenter")
  .description("A CLI tool that adds helpful comments to JavaScript code")
  .version(version)
  .argument("[files...]", "Files to process")
  .option(
    "-o, --output <path>",
    "output directory (default: overwrite original files)",
  )
  .option("--dry-run", "Show what would change, but don't write files")
  .option("--debug", "Show debug output")
  .option("--no-todo", "Do not add TODO comments")
  .option("-c, --config <path>", "Path to a JSON configuration file")
  .action(async (files, options) => {
    try {
      // If no files and not just --help or --version, show error
      if ((!files || files.length === 0) && !options.help && !options.version) {
        console.error("Error: No files specified.");
      process.exit(1);
    }
      if (options.help || options.version) {
        // Let commander handle help/version
        return;
      }
      let config = {};
      if (options.config) {
        const configPath = path.resolve(process.cwd(), options.config);
        try {
          await fs.access(configPath);
          const configContent = await fs.readFile(configPath, "utf8");
          config = JSON.parse(configContent);
        } catch (err) {
          // Config file does not exist or cannot be read
        }
      }
      if (options.debug) {
        process.env.DEBUG = "true";
      }
      const processorOptions = {
        ...config,
        ...options,
        noTodo: options.todo === false,
      };
      if (options.debug) {
        console.error('DEBUG options.noTodo:', options.noTodo);
        console.error('DEBUG processorOptions.noTodo:', processorOptions.noTodo);
        console.error('DEBUG processorOptions:', JSON.stringify(processorOptions));
      }
    const normalizedFiles = files.map((f) => path.resolve(process.cwd(), f));
      const stats = await processFiles(normalizedFiles, processorOptions);
      if (stats.stderr) {
        const fs = require('fs');
        const fd = fs.openSync('.code-commenter-error', 'w');
        fs.writeSync(fd, stats.stderr);
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        process.stderr.write(stats.stderr + '\n');
        setTimeout(() => process.exit(1), 100);
        return;
      }
      if (stats.exitCode && stats.exitCode !== 0) {
        process.exitCode = stats.exitCode;
      }
      // Only exit at the end
      process.exit(process.exitCode || 0);
    } catch (error) {
      console.error("Error in processFiles:", error.message);
      process.exit(1);
    }
  });

// Add error handling for unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Add error handling for uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Parse arguments
try {
  program.parse(process.argv);
} catch (error) {
  console.error("Error parsing arguments:", {
    message: error.message,
    code: error.code,
    name: error.name,
    stack: error.stack,
  });
  process.exit(1);
}

function runCLI(cmd, options) {
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
      status: error.status !== undefined ? error.status : 1,
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
    };
  }
}
