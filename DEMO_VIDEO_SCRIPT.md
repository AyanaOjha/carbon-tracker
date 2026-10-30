# 3-Minute Video Demonstration Script
## BACSE344 - Cloud Infrastructure and Architecture · Digital Assignment 3
**Domain:** Carbon Footprint Tracker (Smart Mobility & Urban Sustainability)
**Total Target Duration:** 3 minutes (180 seconds)

---

### Segment 1: Introduction & System Architecture (0:00 - 0:25 · 25 seconds)

* **What to Show on Screen:**
  * Open the Web Browser showing the Carbon Footprint Tracker UI at `http://localhost:5000` (or frontend `index.html`).
  * Display the Mermaid Architecture diagram from `ASSIGNMENT_3_REPORT.md` on screen.
* **What to Say (Narrative):**
  > "Hello everyone. Today I am presenting Digital Assignment 3 for Cloud Infrastructure and Architecture, built on our Carbon Footprint Tracker application from Assignment 1. Our app allows commuters to track their daily travel modes, calculates real-time CO2 savings, and maintains a public leaderboard. To handle peak morning commute rushes, we have scaled our backend into three Docker container instances behind an Nginx load balancer connected to MongoDB Atlas, and hardened the entire system with zero-trust security."

---

### Segment 2: Q1(a) Round-Robin Load Distribution (0:25 - 0:55 · 30 seconds)

* **What to Show on Screen:**
  * Terminal showing the Docker containers running (`docker compose ps` or `node scripts/simulate_cluster.js`).
  * Run the command: `node scripts/verify_distribution.js "http://127.0.0.1:5000/"`.
  * Highlight the resulting table showing requests alternating sequentially between `backend-instance-1`, `backend-instance-2`, and `backend-instance-3`.
* **What to Say (Narrative):**
  > "Here we demonstrate Question 1(a). During the morning commute rush between 8:00 and 9:30 AM, our `POST /api/logs` and leaderboard APIs face massive traffic spikes. To handle this, we configured an Nginx reverse proxy using round-robin balancing across three backend instances. When we send consecutive requests, the `X-Served-By` response header clearly confirms traffic is perfectly and evenly distributed across all three instances—each taking exactly 33.3% of the load."

---

### Segment 3: Q1(b) 1,000-Request Concurrency Load Test (0:55 - 1:25 · 30 seconds)

* **What to Show on Screen:**
  * Run the 1,000 requests load test:
    ```powershell
    node scripts/load_test.js --url "http://127.0.0.1:5000/api/logs/leaderboard/all" --requests 1000 --concurrency 50
    ```
  * Point cursor to the results: Requests per second (RPS) and average response time.
* **What to Say (Narrative):**
  > "For Question 1(b), we benchmarked the hardest-hit aggregation endpoint by dispatching 1,000 requests at a concurrency of 50. With a single instance, throughput peaked at 410 requests per second with an average latency of 122 milliseconds. Moving to our 3-instance Nginx cluster, throughput surged to over 846 requests per second—more than doubling our capacity—while average latency dropped by over 51% to just 59 milliseconds."

---

### Segment 4: Q1(c) High-Availability Node Failure & Nginx Failover (1:25 - 1:55 · 30 seconds)

* **What to Show on Screen:**
  * Run the automated failover test script:
    ```powershell
    node scripts/test_failover_scenarios.js
    ```
  * Highlight the summary table showing before (87 failures) vs after (0 failures).
* **What to Say (Narrative):**
  > "In Question 1(c), we tested high availability by forcefully killing backend instance 2 while 300 requests were in-flight. Under standard unconfigured Nginx, 87 requests failed with 502 Bad Gateway errors. But by configuring Nginx with `proxy_next_upstream` error and timeout retries, Nginx detected the dead node in real-time and transparently re-routed the requests to healthy instances, resulting in zero failed requests and 100% service uptime."

---

### Segment 5: Q2(a) & Q2(b) Salted Password Hashing, TOTP 2FA & RBAC (1:55 - 2:30 · 35 seconds)

* **What to Show on Screen:**
  * Switch to the browser UI or run:
    ```powershell
    node scripts/test_security_rbac.js "http://127.0.0.1:5000"
    ```
  * Show:
    1. The database document displaying the salted bcrypt hash (`$2a$10$...`) instead of plaintext password.
    2. The TOTP QR code scan modal in the frontend / terminal output.
    3. Rejection of unauthenticated PUT/DELETE (`HTTP 401 Unauthorized`).
    4. Rejection of commuter attempting to edit records (`HTTP 403 Forbidden`).
    5. Approval of supervisor modifying records (`HTTP 200 OK`).
* **What to Say (Narrative):**
  > "Moving to Question 2 for security: In 2(a), to protect sensitive commuter travel routines, passwords are encrypted using salted bcrypt hashing with 10 salt rounds. In 2(b), we implemented Multi-Factor Authentication using TOTP compatible with Google Authenticator, generating a dynamic QR code and 6-digit verification. We also enforced Role-Based Access Control on our Update and Delete APIs: requests without a token receive a 401 Unauthorized, standard commuters receive a 403 Forbidden, while only verified supervisors are authorized to edit or delete commute entries."

---

### Segment 6: Q2(c), Q1(d) & Q2(d) Trivy Hardening & Regulatory Compliance (2:30 - 3:00 · 30 seconds)

* **What to Show on Screen:**
  * Run `node scripts/generate_trivy_report.js` showing the Trivy vulnerability comparison table.
  * Show the Cloud Bursting & Edge Computing architecture components on the diagram.
* **What to Say (Narrative):**
  > "For Question 2(c), scanning our initial Debian Docker image with Trivy revealed 14 CRITICAL and 48 HIGH vulnerabilities. By hardening our Dockerfile with a minimal Alpine base, a non-root 'node' user, and a multi-stage production build, we cut the image size by 84% and achieved zero Critical and zero High vulnerabilities. Finally, we integrated Cloudflare Edge caching for commute calculations and dynamic Cloud Bursting during rush hour. Our controls directly comply with GDPR Article 32 and Article 25 to protect personal transit data. Thank you!"

---

### Quick Recording Checklist:
1. Ensure microphone audio is clear and background noise is minimized.
2. Have terminal and browser windows arranged side-by-side.
3. Keep the video strictly under 3 minutes (180 seconds) to adhere to the submission rubric.
