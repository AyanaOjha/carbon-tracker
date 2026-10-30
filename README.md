# Carbon Footprint Tracker — Digital Assignment 3
> **BACSE344: Cloud Infrastructure & Architecture (Slot C2)**
> **Key Deliverables:** [ASSIGNMENT_3_REPORT.md](ASSIGNMENT_3_REPORT.md) · [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md) · Git Branch: `assignment-3`

A scalable, secure full-stack cloud application to log daily commutes, calculate real-time CO2 savings against passenger car baselines, and maintain public leaderboards.

---

## Digital Assignment 3 Features

### 1. Scalability Engineering (Question 1)
* **3-Instance Backend Cluster:** Orchestrated via `docker-compose.yml` with instances `backend1`, `backend2`, `backend3`.
* **Nginx Load Balancer:** Configured with round-robin traffic distribution and active upstream health retry (`proxy_next_upstream`).
* **High Availability Failover:** Tested node disruption showing reduction of failures from 87 down to **0 failed requests** (100% uptime).
* **High-Throughput Concurrency:** 1,000-request benchmark showing **~2.06x throughput boost** (410 to 846 req/sec) and **51.6% latency drop** (122 ms to 59 ms).
* **Architecture Enhancement:** Integrated Edge/Fog computing (Cloudflare Workers) and dynamic Cloud Bursting for morning rush-hour peaks.

### 2. Zero-Trust Security Engineering (Question 2)
* **Salted bcrypt Password Hashing:** 10 salt rounds applied to all user credentials; plaintext passwords never touch the database.
* **TOTP Multi-Factor Authentication (2FA):** Google Authenticator / Microsoft Authenticator compatible via dynamic QR code generation (`otplib`, `qrcode`).
* **Role-Based Access Control (RBAC):** Restricts `PUT` and `DELETE` APIs to verified `supervisor` roles, rejecting unauthorized commuters (`HTTP 403 Forbidden`) and unauthenticated requests (`HTTP 401 Unauthorized`).
* **Docker Hardening & Trivy Vulnerability Remediation:** Hardened Alpine base (`node:20-alpine`), non-root user (`USER node`), cutting image size by 84% and reducing CRITICAL/HIGH vulnerabilities from **14 Critical / 48 High down to 0**.
* **Regulatory Compliance:** Adherence to GDPR Article 32 & 25 protecting personal transit and movement routines.

---

## Quick Start & Verification Commands

```powershell
# Run the 3-Instance Docker Compose Cluster with Nginx Load Balancer
docker compose up -d --build

# Run Q1(a) 3-Instance Round-Robin Verification
node scripts/verify_distribution.js "http://127.0.0.1:5000/"

# Run Q1(b) 1,000-Request Concurrency Benchmark
node scripts/load_test.js --url "http://127.0.0.1:5000/api/logs/leaderboard/all" --requests 1000 --concurrency 50

# Run Q1(c) High-Availability Node Failover Test (Before vs After)
node scripts/test_failover_scenarios.js

# Run Q2(a) & Q2(b) Password Hashing, MFA (TOTP) & RBAC Security Audit
node scripts/test_security_rbac.js "http://127.0.0.1:5000"

# Generate Q2(c) Trivy Vulnerability Scan Hardening Report
node scripts/generate_trivy_report.js
```

---

## Original Assignment 1 Setup Guide

### 1. Set up MongoDB Atlas
1. Go to mongodb.com/cloud/atlas, create a free account
2. Create a free (M0) cluster
3. Create a database user (username + password)
4. Under "Network Access," allow access from anywhere (0.0.0.0/0) - fine for a student project
5. Click "Connect" -> "Drivers" -> copy the connection string
   (looks like: mongodb+srv://username:password@cluster.mongodb.net/...)

### 2. Set up the backend
```
cd backend
npm install
```
- Copy `.env.example` to a new file called `.env`
- Paste your MongoDB connection string into `.env` as MONGO_URI
- Run it:
```
npm run dev
```
- You should see "Connected to MongoDB Atlas" and "Server running on port 5000"
- Visit http://localhost:5000 in your browser - you should see "Carbon Tracker API is running"

### 3. Run the frontend
- Just open `frontend/index.html` directly in your browser (double-click it)
- Enter your name, log a commute, and it should show up in the table

If something doesn't work: open your browser's Console (right-click -> Inspect -> Console tab)
and check for red error messages - they usually tell you exactly what's wrong.

## How to deploy (put it on the real internet)

### Backend -> Render
1. Push the `backend` folder to a GitHub repo
2. Go to render.com, sign in with GitHub
3. New -> Web Service -> select your repo
4. Set Build Command: `npm install`, Start Command: `npm start`
5. Add an environment variable: MONGO_URI = (your connection string)
6. Deploy - you'll get a live URL like `https://your-app.onrender.com`

### Frontend -> Vercel
1. In `frontend/app.js`, change API_URL to your Render URL + `/api/logs`
2. Push the `frontend` folder to a GitHub repo (or the same repo, different folder)
3. Go to vercel.com, sign in with GitHub, import the repo
4. Deploy - you'll get a live URL like `https://your-app.vercel.app`

That live Vercel link is what you submit/demo.

## API Endpoints (for your documentation)

| Method | Endpoint | What it does |
|--------|----------|---------------|
| POST | /api/logs | Add a new commute log |
| GET | /api/logs/:userName | Get all logs for a user |
| PUT | /api/logs/:id | Edit a log |
| DELETE | /api/logs/:id | Delete a log |
| GET | /api/logs/leaderboard/all | Get CO2-saved leaderboard |

## Database Schema

**CommuteLog**
- userName (text)
- date (date)
- mode (walk / bike / bus / train / car)
- distanceKm (number)
- co2SavedKg (number, auto-calculated)
