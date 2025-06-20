const fs = require('fs/promises');
const path = require('path');
const { parse } = require('acorn');
const walk = require('acorn-walk');
const { generateParamDocs } = require('./param-utils');
const { fileExists, ensureDirectoryExists } = require('./file-utils');
const util = require('util');
const glob = require('glob').glob;
const fsSync = require('fs');
const { parse: tsParse } = require('@typescript-eslint/typescript-estree');

// Enable colors for console output
const colors = require('colors/safe');

// Debug logging function
function debugLog(...args) {
  if (process.env.DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Process a single file to add documentation comments
 * @param {string} filePath - Path to the file to process
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing result
 */
async function processFile(filePath, options = {}) {
  debugLog('Processing file:', filePath);
  debugLog('Options:', JSON.stringify(options, null, 2));

  // Detect TypeScript files
  const isTypeScript = filePath.endsWith('.ts');

  // Helper for TypeScript AST traversal
  function visitTSNode(node, parent, code, options, commentsToInsert) {
    // FunctionDeclaration
    if (node.type === 'FunctionDeclaration' && node.id && node.body) {
      if (!hasComment(node, code)) {
        const comment = generateFunctionComment(node, code, node.id.name, { ...options, isTypeScript });
        if (comment) {
          commentsToInsert.push({ position: node.range[0], text: formatComment(comment, code, node.loc.start.line) });
        }
      }
    }
    // VariableDeclaration with ArrowFunctionExpression
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.init && decl.init.type === 'ArrowFunctionExpression') {
          if (!hasComment(decl, code)) {
            const comment = generateFunctionComment(decl.init, code, decl.id.name, { ...options, isTypeScript });
            if (comment) {
              commentsToInsert.push({ position: decl.range[0], text: formatComment(comment, code, decl.loc.start.line) });
            }
          }
        }
      }
    }
    // ClassDeclaration and methods
    if (node.type === 'ClassDeclaration' && node.body && node.body.body) {
      for (const method of node.body.body) {
        if (["MethodDefinition", "TSDeclareMethod"].includes(method.type)) {
          const kind = method.kind || (method.key && method.key.name);
          let comment;
          if (method.kind === 'get') {
            comment = generateFunctionComment(method, code, `get ${method.key.name}`, { ...options, isGetter: true, isTypeScript });
          } else if (method.kind === 'set') {
            comment = generateFunctionComment(method, code, `set ${method.key.name}`, { ...options, isSetter: true, isTypeScript });
          } else {
            comment = generateFunctionComment(method, code, method.key.name, { ...options, isTypeScript });
          }
          if (comment && !hasComment(method, code)) {
            commentsToInsert.push({ position: method.range[0], text: formatComment(comment, code, method.loc.start.line) });
          }
        }
      }
    }
    // Recurse
    for (const key in node) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(c => c && typeof c.type === 'string' && visitTSNode(c, node, code, options, commentsToInsert));
      } else if (child && typeof child.type === 'string') {
        visitTSNode(child, node, code, options, commentsToInsert);
      }
    }
  }

  try {
    // Read the file
    debugLog('Reading file content...');
    let code;
    try {
      code = await fs.readFile(filePath, 'utf8');
    } catch (err) {
      const msg = `Error: File not found: ${filePath}`;
      console.error(msg);
      if (options.exitOnError) return { error: msg, filePath, skipped: false };
      return { error: msg, filePath, skipped: false };
    }
    debugLog(`File size: ${code.length} characters`);
    if (code.trim() === '') {
      console.log('(no changes needed)');
      return { commentsAdded: 0, skipped: true, exitCode: 0 };
    }

    // Parse the code to AST
    debugLog('Parsing code to AST...');
    let ast;
    let commentsToInsert = [];
    if (isTypeScript) {
      try {
        ast = tsParse(code, { loc: true, range: true });
      } catch (err) {
        const msg = `Error: parsing failed for file: ${filePath}\n${err.message}`;
        console.error(msg);
        if (options.exitOnError) return { error: msg, filePath, skipped: false, exitCode: 1 };
        return { error: msg, filePath, skipped: false, exitCode: 1 };
      }
      debugLog('TypeScript AST parsed successfully');
      visitTSNode(ast, null, code, options, commentsToInsert);
    } else {
      try {
        ast = parse(code, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          locations: true
        });
      } catch (err) {
        const msg = `Error: parsing failed for file: ${filePath}\n${err.message}`;
        console.error(msg);
        if (options.exitOnError) return { error: msg, filePath, skipped: false, exitCode: 1 };
        return { error: msg, filePath, skipped: false, exitCode: 1 };
      }
      debugLog('AST parsed successfully');
      setParents(ast, null);
      commentsToInsert = [];
      // Debug function to log node info
      const logNodeInfo = (node, type) => {
        if (!process.env.DEBUG) return;
        debugLog(`Found ${type} at line ${node.loc.start.line}`);
        debugLog('Node type:', node.type);
        if (node.id) debugLog('Function name:', node.id.name);
        if (node.params && node.params.length > 0) {
          debugLog('Parameters:', node.params.map(p => p.name || p.type).join(', '));
        }
      };
      // Walk the AST to find functions without comments
      debugLog('Walking AST to find functions...');
      walk.simple(ast, {
        FunctionDeclaration(node) {
          debugLog('Found FunctionDeclaration:', node.id?.name, 'at line', node.loc.start.line);
          if (!hasComment(node, code)) {
            debugLog('No comment found for function:', node.id?.name);
            const comment = generateFunctionComment(node, code, node.id?.name || 'Function', { ...options, isTypeScript });
            if (comment) {
              debugLog('Inserting comment for function:', node.id?.name);
              commentsToInsert.push({
                position: node.start,
                text: formatComment(comment, code, node.loc.start.line)
              });
            }
          } else {
            debugLog('Comment already exists for function:', node.id?.name);
          }
        },
        ArrowFunctionExpression(node) {
          if (node.parent && node.parent.type === 'VariableDeclarator' && !hasComment(node.parent, code)) {
            const comment = generateFunctionComment(node, code, node.parent.id?.name || 'Function', { ...options, isTypeScript });
            if (comment) {
              commentsToInsert.push({
                position: node.parent.start,
                text: formatComment(comment, code, node.parent.loc.start.line)
              });
            }
          }
        },
        MethodDefinition(node) {
          if (["method", "constructor", "get", "set"].includes(node.kind) && !hasComment(node, code)) {
            let comment;
            if (node.kind === "get") {
              comment = generateFunctionComment(node.value, code, `get ${node.key.name}`, { ...options, isGetter: true, isTypeScript });
            } else if (node.kind === "set") {
              comment = generateFunctionComment(node.value, code, `set ${node.key.name}`, { ...options, isSetter: true, isTypeScript });
            } else {
              comment = generateFunctionComment(node.value, code, node.key.name, { ...options, isTypeScript });
            }
            if (comment) {
              commentsToInsert.push({
                position: node.start,
                text: formatComment(comment, code, node.loc.start.line)
              });
            }
          }
        }
      });
    }

    // If no comments to add, return early
    if (commentsToInsert.length === 0) {
      if (options.dryRun) {
        console.log('(no changes needed)');
      }
      return { commentsAdded: 0, skipped: true, exitCode: 0 };
    }

    // Sort comments by position (in reverse to avoid offset issues)
    const sortedComments = [...commentsToInsert].sort((a, b) => b.position - a.position);

    // Generate new code with comments
    let newCode = code;
    for (const { position, text } of sortedComments) {
      newCode = newCode.slice(0, position) + text + newCode.slice(position);
    }

    // Handle output based on options
    let outputPath = filePath;
    if (options.output) {
      await ensureDirectoryExists(options.output);
      outputPath = path.join(options.output, path.basename(filePath));
    }

    // Write the file if not in dry-run mode
    if (!options.dryRun) {
      await fs.writeFile(outputPath, newCode, 'utf8');
    } else {
      console.log('(dry run)', filePath);
      console.log(newCode);
      return {
        commentsAdded: commentsToInsert.length,
        skipped: false,
        filePath: outputPath
      };
    }

    return {
      commentsAdded: commentsToInsert.length,
      skipped: false,
      filePath: outputPath
    };

  } catch (error) {
    if (options.continueOnError) {
      console.error(`Error processing ${filePath}:`, error.message);
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
  const lines = code.split('\n');
  const startLine = node.loc.start.line - 1; // 0-based
  // Only consider the line immediately above
  const i = startLine - 1;
  if (i < 0) return false;
  const line = lines[i];
  if (line.trim() === '') {
    return false;
  }
  // Single-line comment
  if (line.trim().startsWith('//')) {
    return true;
  }
  // Multi-line or JSDoc comment
  if (line.trim().endsWith('*/')) {
    // Scan upwards for the start of the multi-line comment
    for (let j = i; j >= 0; j--) {
      if (lines[j].includes('/**') || lines[j].includes('/*')) {
        return true;
      }
      if (lines[j].trim() === '') {
        break; // If blank line inside comment block, stop
      }
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
function generateFunctionComment(node, code, functionName = '', options = {}) {
  try {
    // For TypeScript, pass the AST node directly to processFunctionNode
    let paramDocs;
    if (options.isTypeScript && typeof node === 'object' && node.params) {
      paramDocs = require('./param-utils').processFunctionNode(node, options);
      if (Array.isArray(paramDocs)) paramDocs = paramDocs.join('\n');
    } else {
      // Try to generate parameter documentation from code slice
      const functionCode = code.slice(node.start, node.end);
      paramDocs = require('./param-utils').generateParamDocs(functionCode, options);
    }

    let todoLine = '';
    if (options.todo !== false) {
      if (options.todoTemplate) {
        todoLine = options.todoTemplate.replace('{name}', functionName || 'Function') + '\n';
      } else {
        todoLine = `// TODO: Document what ${functionName || 'Function'} does\n`;
      }
    }
    if (paramDocs) {
      if (options.jsdocTemplate) {
        // Replace placeholders in jsdocTemplate
        const jsdoc = options.jsdocTemplate
          .replace('{name}', functionName || 'Function')
          .replace('{params}', paramDocs.split('\n').filter(l => l.includes('@param')).join('\n'))
          .replace('{returns}', paramDocs.split('\n').find(l => l.includes('@returns')) || '');
        return todoLine + jsdoc;
      } else {
        return todoLine + `/**\n * ${functionName || 'Function'}\n${paramDocs.split('\n').join('\n')}`;
      }
    } else if (todoLine) {
      return todoLine;
    }
  } catch (error) {
    console.error(`Error generating comment for function: ${functionName}`, error.message);
  }
  return null;
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
      const configPath = path.resolve(process.cwd(), 'code-commenter.config.json');
      if (fsSync.existsSync(configPath)) {
        const configContent = await fs.readFile(configPath, 'utf8');
        config = JSON.parse(configContent);
      }
    } catch (e) {
      console.error('Error loading code-commenter.config.json:', e.message);
    }
    const mergedOptions = { ...config, ...options };

    debugLog('Searching for files matching patterns:', patterns);
    const files = await glob(patterns, { nodir: true });
    if (files.length === 0) {
      const msg = 'Error: No files found matching the patterns';
      console.error(msg);
      return { processed: 0, skipped: 0, errors: 1, exitCode: 1 };
    }
    debugLog(`Found ${files.length} files to process`);
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    for (const file of files) {
      try {
        debugLog(`Processing file: ${file}`);
        const result = await processFile(file, mergedOptions);
        if (result && result.error && result.exitCode === 1) {
          errors++;
          debugLog(`Error in file: ${file}`);
        } else if (result && result.skipped) {
          skipped++;
          debugLog(`Skipped file: ${file}`);
        } else {
          processed++;
          debugLog(`Processed file: ${file}`);
        }
      } catch (error) {
        if (error && error.skipped) {
          skipped++;
        } else {
          errors++;
          const errorMsg = `Error processing ${file}: ${error && error.message}`;
          console.error(errorMsg);
          debugLog('Error details:', error && error.stack);
        }
      }
    }
    const exitCode = errors > 0 ? 1 : 0;
    debugLog(`Processing complete. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
    return { processed, skipped, errors, exitCode };
  } catch (error) {
    console.error('Error in processFiles:', error.message);
    debugLog('processFiles error details:', error.stack);
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
  const lines = code.split('\n');
  if (lineNumber < 1 || lineNumber > lines.length) return '';
  const line = lines[lineNumber - 1];
  const match = line.match(/^\s*/);
  return match ? match[0] : '';
}

// Format a comment block with correct indentation and spacing
function formatComment(comment, code, lineNumber) {
  const indent = getIndentation(code, lineNumber);
  // Ensure comment ends with a newline
  let formatted = comment.trimEnd() + '\n';
  // Add indentation to each line except the first
  formatted = formatted.split('\n').map((line, i) => (i === 0 ? line : indent + line)).join('\n');
  // Always add a blank line before the comment for readability
  return '\n' + indent + formatted;
}

// Set parent pointers for all AST nodes (for Acorn AST)
function setParents(node, parent = null) {
  if (node && typeof node === 'object') {
    node.parent = parent;
    for (const key in node) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(c => setParents(c, node));
      } else if (child && typeof child.type === 'string') {
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
  getIndentation
};
