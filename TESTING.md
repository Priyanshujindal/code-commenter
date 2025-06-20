# Testing the Code Commenter

This document explains how to test the code-commenter tool manually.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. A test file has been created at `test-math-utils.js` with various functions that need documentation.

## Running Tests

1. **Run unit tests**:
   ```bash
   npm test
   ```

2. **Check test coverage**:
   ```bash
   npm run test:coverage
   ```

## Testing the CLI

1. **Basic usage** (modifies file in place):
   ```bash
   node bin/code-commenter.js test-math-utils.js
   ```

2. **Dry run** (shows what would be changed without modifying files):
   ```bash
   node bin/code-commenter.js test-math-utils.js --dry-run
   ```

3. **Output to a different directory**:
   ```bash
   node bin/code-commenter.js test-math-utils.js --output ./commented
   ```

4. **Process multiple files**:
   ```bash
   node bin/code-commenter.js "src/**/*.js" "test/**/*.js"
   ```

## Verifying Changes

After running the tool, check the output file for added comments. The tool should:

1. Preserve existing documentation
2. Add TODO comments for undocumented functions
3. Generate parameter documentation when possible
4. Handle different function types (declarations, expressions, methods, etc.)

## Example Output

Before:
```javascript
function add(a, b) {
  return a + b;
}
```

After:
```javascript
/**
 * add
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}
```

## Cleaning Up

To restore the test file to its original state:

```bash
git checkout -- test-math-utils.js
```

## Next Steps

1. Review the generated comments for accuracy
2. Add more test cases for edge cases
3. Update documentation with new features
4. Consider adding more detailed JSDoc tags (@throws, @example, etc.)
