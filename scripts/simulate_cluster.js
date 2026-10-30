/**
 * Multi-Instance Cluster & Load Balancer Simulator
 * Runs 3 backend worker instances (ports 5001, 5002, 5003) and an Nginx-style
 * round-robin reverse proxy on port 5000 with configurable failover behavior.
 * Allows running and verifying Question 1(a), 1(b), and 1(c) in any environment.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const BACKEND_PORTS = [5001, 5002, 5003];
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '8080', 10);
const ENABLE_FAILOVER = process.env.ENABLE_FAILOVER !== 'false'; // default true

const instances = [];
let roundRobinIndex = 0;

// Upstream node health tracker
const upstreamNodes = BACKEND_PORTS.map((port, i) => ({
  id: `backend-instance-${i + 1}`,
  port,
  healthy: true,
  failures: 0
}));

function startBackend(port, instanceId) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..', 'backend'),
    env: {
      ...process.env,
      PORT: port.toString(),
      INSTANCE_ID: instanceId
    },
    stdio: 'ignore'
  });

  child.on('exit', () => {
    const node = upstreamNodes.find(n => n.port === port);
    if (node) node.healthy = false;
  });

  return child;
}

// Forward request to backend instance
function proxyRequest(req, res, targetNode, attempt = 1) {
  const options = {
    hostname: '127.0.0.1',
    port: targetNode.port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${targetNode.port}`,
      'x-forwarded-for': req.socket.remoteAddress
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'x-load-balancer': 'Nginx-Round-Robin',
      'x-served-by': targetNode.id
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    targetNode.healthy = false;
    targetNode.failures++;

    // Nginx proxy_next_upstream behavior (Question 1c)
    if (ENABLE_FAILOVER && attempt < upstreamNodes.length) {
      // Find next healthy node and retry seamlessly
      const nextNode = upstreamNodes.find(n => n.healthy && n.id !== targetNode.id) || upstreamNodes[0];
      return proxyRequest(req, res, nextNode, attempt + 1);
    }

    // Failover disabled or exhausted: return 502 Bad Gateway
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: '502 Bad Gateway',
      message: `Upstream connection to ${targetNode.id}:${targetNode.port} failed`,
      failover: ENABLE_FAILOVER ? 'retried' : 'disabled'
    }));
  });

  req.pipe(proxyReq, { end: true });
}

function startProxyServer() {
  const server = http.createServer((req, res) => {
    // Round-robin selection
    const targetNode = upstreamNodes[roundRobinIndex % upstreamNodes.length];
    roundRobinIndex++;

    proxyRequest(req, res, targetNode, 1);
  });

  server.listen(PROXY_PORT, '0.0.0.0', () => {
    console.log(`[Load Balancer] Running on http://127.0.0.1:${PROXY_PORT}`);
    console.log(`[Load Balancer] Round-robin balancing across ${upstreamNodes.length} backend instances:`);
    upstreamNodes.forEach(n => console.log(`  -> ${n.id} on port ${n.port}`));
    console.log(`[Load Balancer] Nginx proxy_next_upstream failover: ${ENABLE_FAILOVER ? 'ENABLED' : 'DISABLED'}`);
  });

  return server;
}

// Boot up all 3 instances + load balancer
console.log('Spawning 3 backend instances...');
BACKEND_PORTS.forEach((port, i) => {
  const id = `backend-instance-${i + 1}`;
  instances.push(startBackend(port, id));
});

let proxyServer;
setTimeout(() => {
  proxyServer = startProxyServer();
}, 1500);

// Graceful cleanup on SIGINT/SIGTERM
function cleanup() {
  console.log('\nStopping cluster instances and proxy...');
  if (proxyServer) proxyServer.close();
  instances.forEach(child => {
    try { child.kill('SIGKILL'); } catch (e) {}
  });
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
