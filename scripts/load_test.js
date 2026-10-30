/**
 * Load Testing Benchmark Script for Question 1(b)
 * Sends 1,000 requests with fixed concurrency to test throughput & latency.
 * Usage:
 *   node scripts/load_test.js --url http://localhost:5001/api/logs/leaderboard/all --label "1 Instance"
 *   node scripts/load_test.js --url http://localhost:80/api/logs/leaderboard/all --label "3 Instances (Nginx LB)"
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(key, defaultValue) {
  const index = args.indexOf(key);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

const TARGET_URL = getArg('--url', 'http://localhost:5000/api/logs/leaderboard/all');
const TOTAL_REQUESTS = parseInt(getArg('--requests', '1000'), 10);
const CONCURRENCY = parseInt(getArg('--concurrency', '50'), 10);
const LABEL = getArg('--label', 'Benchmark Run');

function sendRequest(url) {
  return new Promise((resolve) => {
    const start = performance.now();
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(url, (res) => {
      let data = '';
      const servedBy = res.headers['x-served-by'] || 'unknown';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({
          statusCode: res.statusCode,
          duration,
          servedBy,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        statusCode: 0,
        duration,
        servedBy: 'none',
        success: false,
        error: err.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        statusCode: 408,
        duration: 5000,
        servedBy: 'timeout',
        success: false,
        error: 'Request Timeout'
      });
    });
  });
}

async function runBenchmark() {
  console.log(`\n============================================================`);
  console.log(`           LOAD TESTING BENCHMARK: ${LABEL.toUpperCase()}`);
  console.log(`============================================================`);
  console.log(`Target URL:         ${TARGET_URL}`);
  console.log(`Total Requests:     ${TOTAL_REQUESTS}`);
  console.log(`Concurrency Level:  ${CONCURRENCY}`);
  console.log(`Starting test...\n`);

  const results = [];
  let completed = 0;
  let currentIndex = 0;
  const startTime = performance.now();

  const worker = async () => {
    while (currentIndex < TOTAL_REQUESTS) {
      currentIndex++;
      const res = await sendRequest(TARGET_URL);
      results.push(res);
      completed++;
      if (completed % 200 === 0 || completed === TOTAL_REQUESTS) {
        process.stdout.write(`Progress: ${completed} / ${TOTAL_REQUESTS} requests completed...\r`);
      }
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const totalTimeMs = performance.now() - startTime;
  const totalTimeSec = totalTimeMs / 1000;

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  const durations = successful.map(r => r.duration).sort((a, b) => a - b);
  const sumDuration = durations.reduce((a, b) => a + b, 0);
  const avgLatency = durations.length ? sumDuration / durations.length : 0;
  const p50 = durations.length ? durations[Math.floor(durations.length * 0.50)] : 0;
  const p95 = durations.length ? durations[Math.floor(durations.length * 0.95)] : 0;
  const p99 = durations.length ? durations[Math.floor(durations.length * 0.99)] : 0;
  const minLatency = durations.length ? durations[0] : 0;
  const maxLatency = durations.length ? durations[durations.length - 1] : 0;
  const rps = (successful.length / totalTimeSec);

  // Distribution across instances
  const instanceDistribution = {};
  results.forEach(r => {
    instanceDistribution[r.servedBy] = (instanceDistribution[r.servedBy] || 0) + 1;
  });

  console.log(`\n\n---------------- BENCHMARK RESULTS ----------------`);
  console.log(`Configuration:            ${LABEL}`);
  console.log(`Total Time Taken:         ${totalTimeSec.toFixed(3)} seconds`);
  console.log(`Completed Requests:       ${results.length}`);
  console.log(`Successful Requests:      ${successful.length}`);
  console.log(`Failed Requests:          ${failed.length}`);
  console.log(`Requests Per Second (RPS): ${rps.toFixed(2)} req/sec`);
  console.log(`Average Response Time:    ${avgLatency.toFixed(2)} ms`);
  console.log(`Median (p50) Latency:     ${p50.toFixed(2)} ms`);
  console.log(`95th Percentile (p95):    ${p95.toFixed(2)} ms`);
  console.log(`99th Percentile (p99):    ${p99.toFixed(2)} ms`);
  console.log(`Min Latency:              ${minLatency.toFixed(2)} ms`);
  console.log(`Max Latency:              ${maxLatency.toFixed(2)} ms`);
  console.log(`Instance Distribution:    `, JSON.stringify(instanceDistribution, null, 2));
  console.log(`============================================================\n`);

  return {
    label: LABEL,
    totalRequests: TOTAL_REQUESTS,
    concurrency: CONCURRENCY,
    timeTakenSec: totalTimeSec,
    rps,
    avgLatencyMs: avgLatency,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    successfulCount: successful.length,
    failedCount: failed.length,
    distribution: instanceDistribution
  };
}

if (require.main === module) {
  runBenchmark();
}

module.exports = { runBenchmark };
