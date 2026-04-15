# The Ultimate Quick Start Guide 🚀
**Full-Stack Liquor POS & Inventory System**

Welcome to the Liquor POS system! This guide is designed to be as detailed and beginner-friendly as possible. Following these steps natively configures your system from complete scratch into a production-ready application.

---

## Part 1: Prerequisites Installation

Before running the application, your computer must have these two core engines installed:

### 1. Install Node.js
Node.js runs our backend API server and powers our frontend development tools.
1. Go to [https://nodejs.org](https://nodejs.org).
2. Download the **LTS (Long Term Support)** installer for your operating system.
3. Run the installer and click "Next" clicking through the default settings.
4. **Verify**: Open a standard terminal (or PowerShell) and type `node -v` and hit enter. It should print a version number (like `v20.x.x`).

### 2. Install MongoDB
MongoDB is our database. It stores users, inventory, sales, and analytics.

**Option A: Local Installation (Recommended for Development)**
1. Go to [MongoDB Community Download](https://www.mongodb.com/try/download/community).
2. Download the MSI / installer and run it.
3. During setup, **keep "Install MongoDB as a Service" checked**, ensuring it runs automatically in the background on port `27017`.
4. (Optional) Download **MongoDB Compass** if you prefer a visual database manager instead of the command line.

**Option B: Cloud Database (Recommended for Production)**
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas/database) and create a free account.
2. Build a free Cluster.
3. Under Network Access, ensure you whitelist your IP or allow access from anywhere (`0.0.0.0/0`).
4. Generate a connection string looking like this: `mongodb+srv://<username>:<password>@cluster0...`

---

## Part 2: Configuration & Initializing the System

### 1. Setup the Backend `.env`
1. Navigate to the `backend` folder inside your project directory.
2. Locate the file named `.env.example`.
3. Create a copy of it and name it exactly `.env` (with the dot in front, and no text before the dot).
4. Open your new `.env` file and verify your `MONGODB_URI`:
   - If you used Local Installation (Option A): `MONGODB_URI=mongodb://localhost:27017/liquor_pos_db`
   - If you used Cloud Database (Option B), replace it entirely with your Atlas connection string.

### 2. Setup the Frontend `.env`
1. Navigate to the `frontend` folder.
2. Locate `.env.example`, copy it, and rename it to `.env`.
3. Ensure it contains the local backend pointer:
   `VITE_API_URL=http://localhost:5000/api`

### 3. Generate Database Secrets (Seeding)
We need to generate your basic user accounts and secure them using our new `bcrypt` algorithms.
1. Open a Terminal and change your directory to the `backend` folder.
   *(Example: `cd C:\path-to-folder\liquor-pos-system\backend`)*
2. Install the backend libraries by typing: `npm install`
3. Generate the default users by typing: `npm run seed`

*You have just created the `liquor_pos_db` database and injected an `admin` and `cashier` user account!*

---

## Part 3: Booting Up the Application!

To run the system locally, you need to spin up the API (Backend) and the Interface (Frontend). 

### 1. Start the Backend API
In the terminal where you generated your users, start the server:
```powershell
npm run dev
```
You should see output stating: `Server running in development mode on port 5000`. Leave this terminal open.

### 2. Start the Frontend Application
1. Open a **brand new Terminal** window.
2. Navigate to your `frontend` folder.
   *(Example: `cd C:\path-to-folder\liquor-pos-system\frontend`)*
3. Install the frontend libraries: `npm install`
4. Start the frontend framework: `npm run dev`

Your terminal will print a local URL: `http://localhost:5173/`. 
**Hold CTRL and click that link** to open the POS system in your default browser!

---

## Part 4: First Steps in the Application

### 1. Logging In
Use the credentials your database officially created during the seed process:
- **Username**: `admin`
- **Password**: `admin123`

### 2. Adding Products & Costs
1. Click the **Products** tab on the left sidebar.
2. Click **Add Product** in the top right.
3. Fill out the details. To guarantee your Profit & Loss works beautifully, ensure you list your direct Cost (BP), Retail Price, and Wholesale requirements. The UI will instantly spit out your expected Profit Margin %.

### 3. Making Complex Sales
1. Navigate to the **POS** tab.
2. Search and tap items to drop them into your live shopping cart.
3. Notice the two Toggle switches directly inside the cart: **Retail Logic** & **Force Wholesale**.
   - **Retail Logic**: Select this. If your product is priced to wholesale after 12 units cross the counter, the system applies it seamlessly automatically.
   - **Force Wholesale**: Select this if you are completing an arbitrary B2B trade. It applies wholesale rates to every item on the docket instantly regardless of threshold limits.
4. Finalize via `Complete Payment`.

### 4. Reading Profit & Loss
1. Navigate to the **Reports** tab securely. 
2. Because your Buying Prices are historically secured deep in the MongoDB registry, your Gross Revenue, explicit COGS (Cost of goods sold), Operating Expenses, and total Net Profit compile visually dynamically!

---

## 🔧 Frequently Asked Troubleshooting

- **"I get an API Network Error during login"** 
  Make sure your first backend terminal is open and actively printing logs on port `5000`.
- **"It says database not connected"**
  Your MongoDB local service is not running. On Windows, search for `Services` in the taskbar, find `MongoDB Server` in the resulting standard list, right-click and press `Start`.
- **"Does the POS fallback if transactions fail natively on local Mongo setup?"**
  Yes. Multi-document transactions require 'replica sets' native to cloud MongoDB Atlas. Since you are using a local single-node test server, our controllers actively catch the transaction failure and seamlessly shift to synchronized, independent database commitments. Sales checkout beautifully offline!
