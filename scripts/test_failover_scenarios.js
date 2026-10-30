/**
 * Automated Demonstration for Question 1(c):
 * Stops one backend instance mid-load test and measures:
 * Case A: Unconfigured Nginx (Failover off) -> Record failed requests
 * Case B: Configured Nginx (Failover / proxy_next_upstream on) -> 0 failed requests
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

function runTest(enableFailover) {
  return new Promise((resolve) => {
    console.log(`\n============================================================`);
    console.log(`  TESTING SCENARIO: ${enableFailover ? 'CONFIGURED NGINX (FAILOVER ON)' : 'UNCONFIGURED NGINX (FAILOVER OFF)'}`);
    console.log(`============================================================`);

    const cluster = spawn('node', ['scripts/simulate_cluster.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        ENABLE_FAILOVER: enableFailover ? 'true' : 'false',
        PROXY_PORT: '8080'
      },
      stdio: 'pipe'
    });

    setTimeout(async () => {
      console.log('Sending requests and simulating node failure (stopping backend-instance-2)...');

      let successful = 0;
      let failed = 0;
      const totalRequests = 300;
      const promises = [];

      for (let i = 0; i < totalRequests; i++) {
        // At request 100, simulate sudden node termination of backend-instance-2 (port 5002)
        if (i === 100) {
          try {
            require('child_process').execSync('Get-NetTCPConnection -LocalPort 5002 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }', { shell: 'powershell.exe' });
            console.log('>>> [DISRUPTION] backend-instance-2 (port 5002) was forcefully STOPPED mid-test!');
          } catch (e) {}
        }

        const p = new Promise((done) => {
          http.get('http://127.0.0.1:8080/', (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 400) {
                successful++;
              } else {
                failed++;
              }
              done();
            });
          }).on('error', () => {
            failed++;
            done();
          });
        });

        promises.push(p);
        await new Promise(r => setTimeout(r, 6));
      }

      await Promise.all(promises);

      console.log(`\nResults for ${enableFailover ? 'Configured Nginx' : 'Unconfigured Nginx'}:`);
      console.log(`  - Total Requests Sent: ${totalRequests}`);
      console.log(`  - Successful Requests: ${successful}`);
      console.log(`  - Failed Requests:     ${failed}`);
      console.log(`  - Success Rate:        ${((successful / totalRequests) * 100).toFixed(1)}%`);

      // Kill the cluster child process tree
      try {
        require('child_process').execSync(`taskkill /pid ${cluster.pid} /T /F`, { stdio: 'ignore' });
      } catch (e) {}

      resolve({
        scenario: enableFailover ? 'Configured Nginx (proxy_next_upstream ON)' : 'Unconfigured Nginx (Failover OFF)',
        totalRequests,
        successful,
        failed,
        failureRate: `${((failed / totalRequests) * 100).toFixed(2)}%`
      });
    }, 2500);
  });
}

async function main() {
  const resultUnconfigured = await runTest(false);
  await new Promise(r => setTimeout(r, 2000));
  const resultConfigured = await runTest(true);

  console.log(`\n============================================================`);
  console.log(`         QUESTION 1(c) COMPARISON SUMMARY TABLE`);
  console.log(`============================================================`);
  console.table([resultUnconfigured, resultConfigured]);
  console.log(`============================================================\n`);
}

main();
