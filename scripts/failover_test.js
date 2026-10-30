/**
 * Failover Verification Script for Question 1(c)
 * Simulates requests while stopping a backend node, comparing:
 * 1. Unconfigured Nginx (Failover off) -> Drops requests (502 Bad Gateway)
 * 2. Configured Nginx (proxy_next_upstream retry enabled) -> 0 failed requests
 */

const http = require('http');
const { performance } = require('perf_hooks');

function executeBurst(targetUrl, totalRequests = 300, concurrency = 20) {
  return new Promise(async (resolve) => {
    let completed = 0;
    let successful = 0;
    let failed = 0;
    const errorDetails = {};

    const sendOne = () => {
      return new Promise((done) => {
        const req = http.get(targetUrl, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
              successful++;
            } else {
              failed++;
              errorDetails[res.statusCode] = (errorDetails[res.statusCode] || 0) + 1;
            }
            done();
          });
        });

        req.on('error', (err) => {
          failed++;
          errorDetails['CONN_ERR'] = (errorDetails['CONN_ERR'] || 0) + 1;
          done();
        });

        req.setTimeout(2000, () => {
          req.destroy();
          failed++;
          errorDetails['TIMEOUT'] = (errorDetails['TIMEOUT'] || 0) + 1;
          done();
        });
      });
    };

    let cur = 0;
    const worker = async () => {
      while (cur < totalRequests) {
        cur++;
        await sendOne();
        completed++;
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    resolve({ total: totalRequests, successful, failed, errors: errorDetails });
  });
}

async function run() {
  const url = process.argv[2] || 'http://localhost:80/';
  const scenario = process.argv[3] || 'active';

  console.log(`\n=============================================================`);
  console.log(`       FAILOVER TEST SCENARIO: ${scenario.toUpperCase()}`);
  console.log(`=============================================================`);
  console.log(`Target: ${url}`);
  console.log(`Running 300 concurrent requests during node disruption...\n`);

  const res = await executeBurst(url, 300, 20);

  console.log(`Total Requests Sent:    ${res.total}`);
  console.log(`Successful Requests:   ${res.successful}`);
  console.log(`Failed Requests:       ${res.failed}`);
  console.log(`Error Breakdown:       `, res.errors);
  console.log(`Failure Rate:          ${((res.failed / res.total) * 100).toFixed(2)}%`);
  console.log(`=============================================================\n`);
}

if (require.main === module) {
  run();
}

module.exports = { executeBurst };
