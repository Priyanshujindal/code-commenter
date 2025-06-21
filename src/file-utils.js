const fs = require("fs/promises");
const path = require("path");
const chalk = require("chalk");
/**
 * Recursively find all JavaScript files matching the given patterns
 * @param {string|string[]} patterns - Glob pattern(s) to match files
 * @returns {Promise<string[]>} Array of file paths
 */
async function findJsFiles(patterns) {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  const results = await Promise.all(
    patternList.map((pattern) =>
      glob(pattern, {
        nodir: true,
        ignore: ["**/node_modules/**", "**/.git/**"],
      }),
    ),
  );
  return Array.from(new Set(results.flat()));
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if the file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Get the relative path from one file to another
 * @param {string} from - Source path
 * @param {string} to - Target path
 * @returns {string} Relative path
 */
function getRelativePath(from, to) {
  return path.relative(path.dirname(from), to);
}

/**
 * Format file size in a human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get file stats
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} File stats
 */
async function getFileStats(filePath) {
  const stats = await fs.stat(filePath);
  return {
    size: stats.size,
    sizeFormatted: formatFileSize(stats.size),
    modified: stats.mtime,
    isDirectory: stats.isDirectory(),
  };
}

/**
 * Checks if a file exists.
 * @param {string} filePath - Path to the file
 * @returns {Promise<string[]>} A promise that resolves to an array of file paths.
 */
async function glob(patterns, options) {
  const { glob } = await import("glob");
  return glob(patterns, options);
}

module.exports = {
  ensureDirectoryExists,
  fileExists,
  getRelativePath,
  formatFileSize,
  getFileStats,
  findJsFiles,
};
