const { performance } = require('perf_hooks');
const path = require('path');
const { processFile } = require('../src/processor');

const LARGE_FILE_PATH = path.join(__dirname, '..', 'fixtures', 'performance', 'large-file.js');

async function runBenchmark() {
  console.log('Starting benchmark...');
  process.env.BENCHMARK = 'true';

  const startTime = performance.now();
  await processFile(LARGE_FILE_PATH, { dryRun: true });
  const endTime = performance.now();

  const duration = (endTime - startTime) / 1000;
  console.log(`Benchmark finished in ${duration.toFixed(2)} seconds.`);
}

runBenchmark(); 