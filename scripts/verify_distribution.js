/**
 * Verification Script for Question 1(a): Load Distribution
 * Sends consecutive requests to Nginx load balancer and inspects the 'X-Served-By' header.
 */

const http = require('http');

const URL = process.argv[2] || 'http://localhost:80/';
const TOTAL = 12;

function checkInstance(index) {
  return new Promise((resolve) => {
    http.get(URL, (res) => {
      let body = '';
      const servedBy = res.headers['x-served-by'] || 'unknown';
      const lb = res.headers['x-load-balancer'] || 'direct';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({
          request: index,
          status: res.statusCode,
          servedBy,
          loadBalancer: lb
        });
      });
    }).on('error', (err) => {
      resolve({
        request: index,
        status: 'ERR',
        servedBy: err.message,
        loadBalancer: 'none'
      });
    });
  });
}

async function verify() {
  console.log(`\n===================================================================`);
  console.log(`   QUESTION 1(a): NGINX 3-INSTANCE ROUND-ROBIN DISTRIBUTION CHECK`);
  console.log(`===================================================================`);
  console.log(`Testing endpoint: ${URL}\n`);

  const results = [];
  for (let i = 1; i <= TOTAL; i++) {
    const res = await checkInstance(i);
    results.push(res);
  }

  console.table(results);

  const counts = {};
  results.forEach(r => {
    counts[r.servedBy] = (counts[r.servedBy] || 0) + 1;
  });

  console.log(`\nSummary of Traffic Distribution Across Backend Instances:`);
  Object.keys(counts).forEach(k => {
    console.log(`  - Instance [${k}]: ${counts[k]} requests (${((counts[k]/TOTAL)*100).toFixed(1)}%)`);
  });
  console.log(`===================================================================\n`);
}

verify();
