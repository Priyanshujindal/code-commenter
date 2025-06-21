# Code Commenter

[![npm version](https://badge.fury.io/js/code-commenter.svg)](https://badge.fury.io/js/code-commenter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build Status](https://github.com/Priyanshujindal/code-commenter/actions/workflows/node.js.yml/badge.svg)](https://github.com/Priyanshujindal/code-commenter/actions)
[![codecov](https://codecov.io/gh/Priyanshujindal/code-commenter/graph/badge.svg)](https://codecov.io/gh/Priyanshujindal/code-commenter)

A CLI tool that scans JavaScript and TypeScript files and suggests simple, beginner-friendly comments for functions and code blocks. It helps improve code documentation by identifying undocumented functions and adding TODO comments where documentation is missing.

## Features

- **JSDoc Generation**: Automatically adds clean, well-formatted JSDoc comments to JavaScript and TypeScript functions.
- **Broad Syntax Support**: Supports function declarations, arrow functions, class methods, getters, and setters.
- **Smart Tag Generation**:
  - Automatically adds an `@returns` tag if a `return` statement is detected.
  - Generates `@example` tags with placeholder values.
- **Complex Parameter Handling**:
  - Understands deeply nested and destructured parameters.
  - Correctly documents rest parameters and TypeScript parameter properties.
  - Handles functions inside object literals.
- **Improved Type Inference**: Infers parameter and return types from default values and TypeScript type annotations.
- **Customizable**:
  - Comment templates can be customized via `code-commenter.config.json`.
  - Skips already-documented functions.
- **Developer-Friendly**:
  - Robust error handling with user-friendly output.
  - Standard `--version` and `--help` flags.

## Quick Start

1. **Install (globally or locally):**

```sh
npm install -g code-commenter
# or for local use
npm install --save-dev code-commenter
```

2. **Run on your codebase:**

```sh
code-commenter "src/**/*.js"
code-commenter "src/**/*.ts"
```

3. **See the results:**

- Your files will be updated in-place with JSDoc comments above each function.
- Use `--dry-run` to preview changes without writing files.

## CLI Usage

```sh
code-commenter <file/glob> [options]
```

### Examples

- Add comments to all JS files in `src/`:
  ```sh
  code-commenter "src/**/*.js"
  ```
- Add comments to all TS files, preview only:
  ```sh
  code-commenter "src/**/*.ts" --dry-run
  ```
- Output commented files to a separate directory:
  ```sh
  code-commenter "src/**/*.js" --output commented
  ```
- Check the current version:
  ```sh
  code-commenter --version
  ```

### Options

| Option      | Description                                            |
| ----------- | ------------------------------------------------------ |
| `--config`  | Path to a custom JSON configuration file                |
| `--debug`   | Show debug output                                      |
| `--dry-run` | Show what would change, but don't write files          |
| `--help`    | Show CLI help                                          |
| `--output`  | Directory to write output files to (default: in-place) |
| `--version` | Show the current version                               |

## Advanced Features

code-commenter can handle a variety of advanced JavaScript and TypeScript patterns.

### Robust Error Handling

When the tool encounters a syntax error in a file, it will print a user-friendly code frame that pinpoints the exact location of the error, making it easy to identify and fix.

### Deeply Destructured Parameters

The tool can understand and document parameters that are deeply destructured.

**Example:**

```javascript
function processData({ data: { id, values: [val1, val2] }, options: { enabled } }) {
  // ...
}
```

**Generated JSDoc:**

```javascript
/**
 * @summary TODO: Document what processData does
 * 
 * @param {Object} param0 - Object parameter
 * @param {Object} param0.data - Property 'data'
 * @param {any} param0.data.id - Property 'id'
 * @param {any} param0.data.values - Property 'values'
 * @param {Object} param0.options - Property 'options'
 * @param {any} param0.options.enabled - Property 'enabled'
 * @returns {any} - The return value
 * @example processData({ data: { id: null, values: [] }, options: { enabled: null } })
 */
```

### Functions in Object Literals

It can also document functions and arrow functions assigned to properties in an object.

**Example:**

```javascript
const utils = {
  add: function(a, b) {
    return a + b;
  },
  subtract: (a, b) => {
    return a - b;
  },
};
```

**Generated JSDoc:**

```javascript
/**
 * @summary TODO: Document what add does
 * 
 * @param {any} a - Parameter 'a'
 * @param {any} b - Parameter 'b'
 * @returns {any} - The return value
 * @example add(null, null)
 */
/**
 * @summary TODO: Document what subtract does
 * 
 * @param {any} a - Parameter 'a'
 * @param {any} b - Parameter 'b'
 * @returns {any} - The return value
 * @example subtract(null, null)
 */
```

## TypeScript Support

code-commenter fully supports TypeScript files (`.ts`) and can extract parameter types, including advanced features:

- **Parameter Properties**: Class constructor parameters with access modifiers are marked as parameter properties in the JSDoc.
- **Destructured Parameters**: If a destructured parameter has a type annotation (e.g., `{a, b}: MyType`), the type is used in the JSDoc.
- **Rest Parameters**: Rest parameters are documented as `@param {...Type} name`.
- **`@returns` tag**: Automatically added if a `return` statement is found.

**Example:**

```ts
class Example {
  constructor(
    public foo: string, // parameter property
    { a, b }: BarType, // destructured with type
    ...args: number[] // rest parameter
  ) {}
}
```

The generated JSDoc will look like:

```js
/**
 * @summary TODO: Document what constructor does
 * 
 * @param {string} foo - Parameter 'foo'
 * @param {BarType} param1 - Object parameter
 * @param {...number} args - Rest parameter
 * @returns {any} - The return value
 * @example Example(null, null, null)
 */
```

code-commenter will always use the best available type information for parameters, including generics, unions, and intersections where possible.

## Configuration

You can configure `code-commenter` in two ways:

1.  **`code-commenter.config.json`**: Create this file in your project root. The CLI will automatically load and use it.
2.  **`--config` option**: Specify a path to a custom JSON configuration file.

The configuration file allows you to customize the generated comments.

**Example `code-commenter.config.json`:**

```json
{
  "todoTemplate": "// TODO: Describe {name}",
  "jsdocTemplate": "/**\n * {name}\n{params}\n{returns}\n */"
}
```

Available options are the same as the CLI flags (e.g., `dryRun`, `output`, etc.). CLI options will always override options in the configuration file.

## Status

This tool is production-ready and fully tested. All features and edge cases are covered by the test suite. If you have suggestions or want to request new features, please open an issue or pull request.

## Development

### Prerequisites

- Node.js 14.0 or higher
- npm 6.0 or higher

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/Priyanshujindal/code-commenter.git
   cd code-commenter
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up pre-commit hooks (runs linter and formatter before each commit):
   ```bash
   npx husky install
   ```

### Available Scripts

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Format code
npm run format

# Run end-to-end tests
npm run test:e2e
```

### Test Structure

- `test/processor.test.js` - Unit tests for the core processor functionality
- `test/cli.test.js` - Integration tests for the command-line interface
- `test/fixtures/` - Test files used in the test suite

## Continuous Integration

This project uses GitHub Actions for CI/CD. The workflow includes:

- Running tests on multiple Node.js versions
- Code coverage reporting via Codecov
- Linting and code formatting checks
- Build verification

[![Node.js CI](https://github.com/Priyanshujindal/code-commenter/actions/workflows/node.js.yml/badge.svg)](https://github.com/Priyanshujindal/code-commenter/actions/workflows/node.js.yml)

### Cross-Platform and CI Robustness

- The test suite is fully cross-platform and runs on Linux, macOS, and Windows.
- **Symlink test:** For maximum reliability, the symlink test is automatically skipped in CI environments and on Windows, as symlink support can be inconsistent or restricted. All other tests pass on all platforms and in CI.
- This ensures that your codebase is robust, and CI/CD pipelines will always be green unless there is a real code or logic error.

### Coverage Reports

Code coverage reports are generated during CI and can be viewed on Codecov:

[![codecov](https://codecov.io/gh/Priyanshujindal/code-commenter/graph/badge.svg)](https://codecov.io/gh/Priyanshujindal/code-commenter)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Acorn](https://github.com/acornjs/acorn) - A small, fast, JavaScript-based JavaScript parser
- [Commander.js](https://github.com/tj/commander.js) - Node.js command-line interfaces made easy
- [Chalk](https://github.com/chalk/chalk) - Terminal string styling done right

---

## Author

- Priyanshu Jindal  
  [LinkedIn](https://www.linkedin.com/in/priyanshu-jindal-18a103324/)

---

Made with ❤️ by Priyanshu jindal
