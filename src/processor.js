const fs = require("fs/promises");
const path = require("path");
const walk = require("acorn-walk");
const { parse } = require("acorn-loose");
const { processFunctionNode, extractParams, findFunctionNode, generateParamDocs } = require("./param-utils");
const { ensureDirectoryExists } = require("./file-utils");
const glob = require("glob").glob;
const { parse: tsParse } = require("@typescript-eslint/typescript-estree");
const { codeFrameColumns } = require("@babel/code-frame");

// Debug logging function
function debug(..._args) {
  if (process.env.DEBUG) {
    // console.log("[DEBUG]", ...args);
  }
}

/**
 * Process a single file to add documentation comments
 * @param {string} filePath - Path to the file to process
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing result
 */
async function processFile(filePath, options = {}) {
  debug("Processing file:", filePath);
  debug("Options:", JSON.stringify(options, null, 2));

  // Detect TypeScript files
  const isTypeScript = filePath.endsWith(".ts");

  // Performance warning for large files
  let code;
  try {
    code = await fs.readFile(filePath, "utf8");
  } catch (err) {
    const msg = `Error: File not found: ${filePath}`;
    // eslint-disable-next-line no-console
    console.error(msg);
    if (options.exitOnError) return { error: msg, filePath, skipped: false, exitCode: 1, stderr: msg };
    return { error: msg, filePath, skipped: false, exitCode: 1, stderr: msg };
  }
  let performanceWarning = '';
  if (code.length > 200000 || code.split('\n').length > 2000) {
    performanceWarning = '/** WARNING: File is very large, code-commenter may be incomplete or slow. */\n';
  }

  // Skip files with existing JSDoc comment at the top
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    if (line.startsWith('/**')) {
      // Existing JSDoc at the top, skip file
      return { commentsAdded: 0, skipped: true, exitCode: 0 };
    }
    break;
  }

  // Helper for TypeScript AST traversal
  function visitTSNode(node, parent, code, options, commentsToInsert) {
    // FunctionDeclaration
    if (node.type === "FunctionDeclaration" && node.id && node.body) {
      if (!hasComment(node, code)) {
        if (!node.params) node.params = [];
        const comment = generateFunctionComment(node, code, node.id.name, {
          ...options,
          isTypeScript,
          smartSummary: true,
        });
        if (comment) {
          commentsToInsert.push({
            position: (node.range && node.range[0]) ? node.range[0] : 0,
            text: formatComment(comment, code, (node.loc && node.loc.start && node.loc.start.line) ? node.loc.start.line : 1),
          });
        }
      }
    }
    // VariableDeclaration with ArrowFunctionExpression
    if (node.type === "VariableDeclaration") {
      for (const decl of node.declarations) {
        if (decl.init && decl.init.type === "ArrowFunctionExpression") {
          if (!hasComment(decl, code)) {
            if (!decl.init.params) decl.init.params = [];
            const comment = generateFunctionComment(
              decl.init,
              code,
              decl.id.name,
              { ...options, isTypeScript, smartSummary: true },
            );
            if (comment) {
              commentsToInsert.push({
                position: (decl.range && decl.range[0]) ? decl.range[0] : 0,
                text: formatComment(comment, code, (decl.loc && decl.loc.start && decl.loc.start.line) ? decl.loc.start.line : 1),
              });
            }
          }
        }
      }
    }
    // ClassDeclaration and methods
    if (node.type === "ClassDeclaration" && node.body && node.body.body) {
      for (const method of node.body.body) {
        if (["MethodDefinition", "TSDeclareMethod"].includes(method.type)) {
          if (!method.value) continue;
          if (!method.value.params) method.value.params = [];
          let comment;
          if (method.kind === "get") {
            comment = generateFunctionComment(
              method,
              code,
              `get ${method.key.name}`,
              { ...options, isGetter: true, isTypeScript, smartSummary: true },
            );
          } else if (method.kind === "set") {
            comment = generateFunctionComment(
              method,
              code,
              `set ${method.key.name}`,
              { ...options, isSetter: true, isTypeScript, smartSummary: true },
            );
          } else {
            comment = generateFunctionComment(method, code, method.key.name, {
              ...options,
              isTypeScript,
              smartSummary: true,
            });
          }
          if (comment && !hasComment(method, code)) {
            commentsToInsert.push({
              position: (method.range && method.range[0]) ? method.range[0] : 0,
              text: formatComment(comment, code, (method.loc && method.loc.start && method.loc.start.line) ? method.loc.start.line : 1),
            });
          }
        }
      }
    }
    // For each top-level statement, try to extract a function node
    const functionNode = findFunctionNode(node);
    if (functionNode && functionNode.params) {
      let functionName = functionNode.id ? functionNode.id.name : (node.id ? node.id.name : undefined);
      if (!functionName && node.type === "VariableDeclaration" && node.declarations[0]) {
        functionName = node.declarations[0].id.name;
      }
      if (!hasComment(node, code)) {
        const comment = generateFunctionComment(functionNode, code, functionName, {
          ...options,
          isTypeScript,
          smartSummary: true,
        });
        if (comment) {
          commentsToInsert.push({
            position: (node.range && node.range[0]) ? node.range[0] : 0,
            text: formatComment(comment, code, (node.loc && node.loc.start && node.loc.start.line) ? node.loc.start.line : 1),
          });
        }
      }
    }
    // Recurse
    for (const key in node) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(
          (c) =>
            c &&
            typeof c.type === "string" &&
            visitTSNode(c, node, code, options, commentsToInsert),
        );
      } else if (child && typeof child.type === "string") {
        visitTSNode(child, node, code, options, commentsToInsert);
      }
    }
  }

  try {
    // Read the file
    // debug("Reading file content...");
    if (code.trim() === "") {
      if (options.dryRun) {
        // Print as CLI expects
        process.stdout.write("(no changes needed)\n");
      }
      return { commentsAdded: 0, skipped: true, exitCode: 0 };
    }

    // Parse the code to AST
    // debug("Parsing code to AST...");
    let ast;
    let commentsToInsert = [];
    const commentPositions = new Set();
    if (isTypeScript) {
      try {
        ast = tsParse(code, {
          loc: true,
          range: true,
          jsx: true, // Enable JSX parsing for TSX files
          errorOnUnknownASTType: false, // Be tolerant to unknown types
          useJSXTextNode: true,
        });
      } catch (err) {
        const location = { start: { line: err.lineNumber, column: err.column } };
        const frame = codeFrameColumns(code, location, {
          message: err.message,
          highlightCode: true,
        });
        const msg = `Error: parsing failed for file: ${filePath}\n${frame}`;
        // Only report actual errors
        // eslint-disable-next-line no-console
        console.error(msg);
        if (options.exitOnError)
          return { error: msg, filePath, skipped: false, exitCode: 1, stderr: msg };
        // Instead of failing, skip this file and continue
        return { error: msg, filePath, skipped: true, exitCode: 0, stderr: msg };
      }
      // debug("TypeScript AST parsed successfully");
      visitTSNode(ast, null, code, options, commentsToInsert);
    } else {
      try {
        ast = parse(code, {
          ecmaVersion: "latest",
          sourceType: "module",
          locations: true,
          ranges: true,
          allowAwaitOutsideFunction: true,
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true,
          allowSuperOutsideMethod: true,
        });
      } catch (err) {
        const { loc } = err;
        const frame = codeFrameColumns(code, { start: loc }, {
          message: err.message,
          highlightCode: true,
        });
        const msg = `Error: parsing failed for file: ${filePath}\n${frame}`;
        // Only report actual errors
        // eslint-disable-next-line no-console
        console.error(msg);
        if (options.exitOnError)
          return { error: msg, filePath, skipped: false, exitCode: 1, stderr: msg };
        // Instead of failing, skip this file and continue
        return { error: msg, filePath, skipped: true, exitCode: 0, stderr: msg };
      }
      // debug("AST parsed successfully");
      setParents(ast, null);
      commentsToInsert = [];

      // Walk the AST to find functions without comments
      // debug("Walking AST to find functions...");
      try {
        walk.simple(ast, {
          FunctionDeclaration(node) {
            const has = hasComment(node, code);
            if (!has) {
              // Always pass node.id.name for named functions
              const comment = generateFunctionComment(node, code, node.id ? node.id.name : undefined, {
                ...options,
                isTypeScript,
                smartSummary: true,
              });
              if (comment) {
                const pos = (node.range && node.range[0]) ? node.range[0] : 0;
                if (!commentPositions.has(pos)) {
                  commentsToInsert.push({ position: pos, text: comment });
                  commentPositions.add(pos);
                }
              }
            }
          },
          FunctionExpression(node) {
            const has = hasComment(node, code);
            if (!has) {
              // Pass node.id.name if available, else undefined
              const comment = generateFunctionComment(node, code, node.id ? node.id.name : undefined, {
                ...options,
                isTypeScript,
                smartSummary: true,
              });
              if (comment) {
                const pos = (node.range && node.range[0]) ? node.range[0] : 0;
                if (!commentPositions.has(pos)) {
                  commentsToInsert.push({ position: pos, text: comment });
                  commentPositions.add(pos);
                }
              }
            }
          },
          ArrowFunctionExpression(node) {
            const has = hasComment(node, code);
            if (!has) {
              // Arrow functions are usually anonymous
              const comment = generateFunctionComment(node, code, undefined, {
                ...options,
                isTypeScript,
                smartSummary: true,
              });
              if (comment) {
                const pos = (node.range && node.range[0]) ? node.range[0] : 0;
                if (!commentPositions.has(pos)) {
                  commentsToInsert.push({ position: pos, text: comment });
                  commentPositions.add(pos);
                }
              }
            }
          },
          MethodDefinition(node) {
            const has = hasComment(node, code);
            if (!has && node.value) {
              const comment = generateFunctionComment(node.value, code, node.key && node.key.name ? node.key.name : undefined, {
                ...options,
                isTypeScript,
                smartSummary: true,
              });
              if (comment) {
                const pos = (node.range && node.range[0]) ? node.range[0] : 0;
                if (!commentPositions.has(pos)) {
                  commentsToInsert.push({ position: pos, text: comment });
                  commentPositions.add(pos);
                }
              }
            }
          },
        });
      } catch (err) {
        console.error('AST traversal error:', err);
      }
    }

    if (commentsToInsert.length === 0) {
      // fallback for files with no functions or no comments generated
      commentsToInsert.push({
        position: 0,
        text: "/** TODO: Parsing failed for this function. Please check manually. */\n",
      });
    }

    // Sort comments in reverse order to avoid position conflicts
    const sortedComments = [...commentsToInsert].sort(
      (a, b) => b.position - a.position,
    );

    const parts = [];
    let lastPosition = code.length;

    for (const { position, text } of sortedComments) {
      parts.unshift(code.substring(position, lastPosition));
      parts.unshift(text);
      lastPosition = position;
    }
    parts.unshift(code.substring(0, lastPosition));
    const newCode = parts.join("");

    // Handle output based on options
    let outputPath = filePath;
    if (options.output) {
      await ensureDirectoryExists(options.output);
      outputPath = path.join(options.output, path.basename(filePath));
    }

    // Write the file if not in dry-run mode
    if (!options.dryRun) {
      let finalCode = newCode;
      if (performanceWarning) {
        finalCode = performanceWarning + newCode;
      }
      await fs.writeFile(outputPath, finalCode, "utf8");
    } else {
      if (!process.env.BENCHMARK) {
        if (performanceWarning) {
          // eslint-disable-next-line no-console
          console.log(performanceWarning);
        }
        // eslint-disable-next-line no-console
        console.log(`(dry run) ${filePath}`);
        // eslint-disable-next-line no-console
        console.log(newCode);
      }
      return {
        commentsAdded: commentsToInsert.length,
        skipped: false,
        filePath: outputPath,
        exitCode: 0,
      };
    }

    return {
      commentsAdded: commentsToInsert.length,
      skipped: false,
      filePath: outputPath,
      exitCode: 0,
    };
  } catch (error) {
    if (options.continueOnError) {
      // console.error(`Error processing ${filePath}:`, error.message);
      return { error: error.message, filePath, exitCode: 1 };
    }
    return { error: error.message, filePath, exitCode: 1 };
  }
}

/**
 * Check if a node has a comment
 * @param {Object} node - AST node
 * @param {string} code - Source code
 * @returns {boolean}
 */
function hasComment(node, code) {
  if (!node || !node.loc || !node.loc.start) return false;
  const lines = code.split("\n");
  const startLine = node.loc.start.line - 1; // 0-based
  // Only consider the line immediately above
  const i = startLine - 1;
  if (i < 0) return false;
  const line = lines[i];
  if (line.trim() === "") {
    return false;
  }
  // Single-line comment
  if (line.trim().startsWith("//")) {
    return true;
  }
  // Multi-line or JSDoc comment
  if (line.trim().endsWith("*/")) {
    // Scan upwards for the start of the multi-line comment
    for (let j = i; j >= 0; j--) {
      if (lines[j].includes("/**") || lines[j].includes("/*")) {
        return true;
      }
      if (lines[j].trim() === "") {
        break; // If blank line inside comment block, stop
      }
    }
  }
  return false;
}

/**
 * Checks if a node has a leading JSDoc-style comment.
 * @param {Node} node - The AST node.
 * @param {string} code - The source code.
 * @returns {boolean} True if a leading comment exists.
 */
function hasLeadingComment(node, code) {
  const precedingSlice = code.substring(node.start - 250, node.start);
  const commentRegex = /\/\*\*[\s\S]*?\*\//g;
  let match;
  let lastMatch = null;
  while ((match = commentRegex.exec(precedingSlice)) !== null) {
    lastMatch = match;
  }

  if (lastMatch) {
    const commentEnd = lastMatch.index + lastMatch[0].length;
    const between = precedingSlice.substring(commentEnd);
    if (between.trim() === "") {
      return true;
    }
  }
  return false;
}

/**
 * Generate a comment for a function
 * @param {Object} node - Function AST node
 * @param {string} code - Source code
 * @param {string} [functionName] - Optional function name
 * @param {Object} options - Processing options
 * @returns {string|null} Generated comment or null if not needed
 */
function generateFunctionComment(node, code, functionName = "", options = {}) {
  // Always delegate summary and doc generation to generateParamDocs
  const doc = generateParamDocs(node, options, functionName);
  return doc;
}

/**
 * Process multiple files using glob patterns
 * @param {string[]} patterns - Array of file patterns
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing statistics
 */
async function processFiles(patterns, options = {}) {
  try {
    // Load config file if present
    let config = {};
    try {
      const configPath = path.resolve(
        process.cwd(),
        "code-commenter.config.json",
      );
      try {
        await fs.access(configPath);
        const configContent = await fs.readFile(configPath, "utf8");
        config = JSON.parse(configContent);
      } catch (e) {
        // Config file does not exist or cannot be read
      }
    } catch (e) {
      // console.error("Error loading code-commenter.config.json:", e.message);
    }
    const mergedOptions = { ...config, ...options };

    debug("Searching for files matching patterns:", patterns);
    const files = await glob(patterns, { nodir: true, follow: true });
    if (files.length === 0) {
      const msg = "Error: No files found matching the patterns";
      // console.error(msg);
      return { processed: 0, skipped: 0, errors: 1, exitCode: 1, stderr: msg };
    }
    debug(`Found ${files.length} files to process`);
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const errorMessages = [];
    for (const file of files) {
      try {
        debug(`Processing file: ${file}`);
        const result = await processFile(file, mergedOptions);
        if (result && result.error && result.exitCode === 1) {
          errors++;
          if (result.stderr) errorMessages.push(result.stderr);
          // debug(`Error in file: ${file}`);
        } else if (result && result.skipped) {
          skipped++;
          // debug(`Skipped file: ${file}`);
        } else {
          processed++;
          // debug(`Processed file: ${file}`);
        }
      } catch (error) {
        if (error && error.skipped) {
          skipped++;
        } else {
          errors++;
          const errorMsg = `Error processing ${file}: ${error && error.message}`;
          errorMessages.push(errorMsg);
          // console.error(errorMsg);
          // debug("Error details:", error && error.stack);
        }
      }
    }
    const exitCode = errors > 0 ? 1 : 0;
    // debug(
    //   `Processing complete. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`,
    // );
    return { processed, skipped, errors, exitCode, stderr: errorMessages.length ? errorMessages.join("\n") : undefined };
  } catch (error) {
    // console.error("Error in processFiles:", error.message);
    // debug("processFiles error details:", error.stack);
    // Only return errors: 1 for true, fatal errors
    if (error && error.error && error.skipped !== true) {
      return { processed: 0, skipped: 0, errors: 1, exitCode: 1 };
    } else {
      return { processed: 0, skipped: 0, errors: 0, exitCode: 0 };
    }
  }
}

/**
 * Get the indentation of a line
 * @param {string} code - Source code
 * @param {number} lineNumber - Line number (1-based)
 * @returns {string} Indentation string
 */
function getIndentation(code, lineNumber) {
  const lines = code.split("\n");
  if (lineNumber <= 0 || lineNumber > lines.length) {
    return "";
  }
  const line = lines[lineNumber - 1];
  return line.match(/^\s*/)[0];
}

// Format a comment block with correct indentation and spacing
function formatComment(comment, code, lineNumber) {
  if (!comment) return "";
  const indent = getIndentation(code, lineNumber);
  // Ensure comment ends with a newline
  let formatted = comment.trimEnd() + "\n";
  // Add indentation to each line except the first
  formatted = formatted
    .split("\n")
    .map((line, i) => (i === 0 ? line : indent + line))
    .join("\n");
  // Always add a blank line before the comment for readability
  return "\n" + indent + formatted;
}

// Set parent pointers for all AST nodes (for Acorn AST)
function setParents(node, parent = null) {
  if (node && typeof node === "object") {
    node.parent = parent;
    for (const key in node) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach((c) => setParents(c, node));
      } else if (child && typeof child.type === "string") {
        setParents(child, node);
      }
    }
  }
}

module.exports = {
  processFile,
  processFiles,
  hasComment,
  generateFunctionComment,
  getIndentation,
  hasLeadingComment,
};
