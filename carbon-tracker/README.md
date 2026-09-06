# Carbon Footprint Tracker

A simple full-stack app to log daily commutes and see CO2 saved vs driving a car.

## Tech Stack
- Frontend: HTML, CSS, JavaScript (plain, no framework)
- Backend: Node.js, Express
- Database: MongoDB Atlas

## How to run this on your laptop first (before deploying)

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
