# Liquor POS System - Project Summary

## Current Project State
The application is a fully modernized, production-ready full-stack MERN (MongoDB, Express, React, Node) application. Initially starting as a PostgreSQL prototype, the system has successfully undergone a massive architectural shift to native MongoDB utilizing modern ES Modules (`import`/`export`), along with a comprehensive frontend visual overhaul featuring glassmorphism elements, dynamic charting, and complex reporting tools.

## Architecture
- **Frontend**: Built with React (Vite-powered). Features extensive use of `lucide-react` for iconography and `recharts` for internal analytics. Global state and themes are handled via native React Context and CSS root variables respectively.
- **Backend**: Built with Node.js & Express using strict ES Module bindings. Interacts directly with a standalone or clustered MongoDB database utilizing `mongoose` schemas. Employs Helmet, CORS, and Express Rate Limiting for security.

## Core Features
- **Sophisticated POS**: Dual-pricing logic natively integrated. Checkout interactions allow the cashier to explicitly toggle "Retail Logic" (utilizing automatic thresholds) or "Force Wholesale" entirely.
- **Product Margins**: Products track `buying_price`, explicitly displaying computed profit margins against both retail and wholesale selling prices.
- **P&L Reporting**: Custom aggregations calculate COGS (Cost of Goods Sold), Gross Revenue, and accurately deduce total Operating Expenses to present a live **Net Profit** statement.
- **Secure Auth**: JWT-based authentication storing roles (`admin`, `cashier`, `manager`) governing access to reports and inventory overriding.

---

## Configuration & Deployment Guide

### 1. MongoDB Configuration
The backend strictly relies on MongoDB. 

1. Ensure MongoDB is running locally (`mongodb://localhost:27017`) or you have an initialized MongoDB Atlas cluster.
2. In the `backend` folder, duplicate `.env.example` into `.env`. 
3. Edit your `.env` configuring exactly where MongoDB lives:
```env
MONGODB_URI=mongodb://localhost:27017/liquor_pos_db
# OR
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/liquor_pos_db?retryWrites=true&w=majority
```
4. Run `npm run seed` in the backend folder to establish your initial admin user if deploying for the first time.

> **Note on Transactions**: The system safely attempts `session.startTransaction()` on purchases. If you are using a single-node local replica, it detects the server constraint and automatically performs synchronized static operations as a safe fallback. 

### 2. Preparing for Production Deployment
The source code has been prepared for standard unified or isolated deployment.

**Unified MERN Deployment Strategy (e.g. Heroku, Render):**
Because we've configured our `server.js` production scripts, you can deploy both natively on one box.
1. At the CLI, navigate to `frontend` and run: `npm install && npm run build`
2. This creates a highly optimized `frontend/dist` directory.
3. In your production environment, set the variable `NODE_ENV=production`. 
4. The Express API (`backend/server.js`) natively intercepts non-API requests and maps them explicitly resolving back to the `frontend/dist/index.html` structure automatically! 

**Standalone Environment Variables Required in Production:**
- Backend:
  - `PORT=5000`
  - `NODE_ENV=production`
  - `JWT_SECRET=your_super_secret_production_key`
  - `MONGODB_URI=your_live_db_url`
  
- Frontend *(If hosted separately on Vercel/Netlify)*:
  - `VITE_API_URL=https://your-live-backend.com/api`
