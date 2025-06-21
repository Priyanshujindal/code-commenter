const fs = require('fs/promises');
const path = require('path');

const NUM_FUNCTIONS = 10000;
const OUTPUT_DIR = path.join(__dirname, '..', 'fixtures', 'performance');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'large-file.js');

async function generateLargeFile() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let content = '';
  for (let i = 0; i < NUM_FUNCTIONS; i++) {
    content += `
function function_${i}(param1, param2) {
  const result = param1 + param2 * ${i};
  return result;
}
`;
  }

  await fs.writeFile(OUTPUT_FILE, content);
  console.log(`Generated ${OUTPUT_FILE} with ${NUM_FUNCTIONS} functions.`);
}

generateLargeFile(); 