# 🔄 MongoDB Conversion Guide

## ✅ What's Been Changed

The system has been converted from PostgreSQL to MongoDB. Here's what was done:

### 1. Dependencies Updated
- Removed: `pg` (PostgreSQL client)
- Added: `mongoose` (MongoDB ODM)

### 2. Database Configuration
**File:** `config/database.js`
- Converted from PostgreSQL pool to Mongoose connection
- Uses MongoDB URI from environment

### 3. Environment Variables
**File:** `.env`
```env
# OLD (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=liquor_pos_db
DB_USER=postgres
DB_PASSWORD=your_password

# NEW (MongoDB)
MONGODB_URI=mongodb://localhost:27017/liquor_pos_db
```

### 4. Models Created (8 Total)
All models now use Mongoose schemas:
- ✅ `models/User.js` - User authentication
- ✅ `models/Product.js` - Product catalog
- ✅ `models/ProductVariant.js` - Product variants
- ✅ `models/Customer.js` - Customer database
- ✅ `models/Sale.js` - Sales transactions
- ✅ `models/SaleItem.js` - Sale line items
- ✅ `models/Expense.js` - Expense tracking
- ✅ `models/StockAdjustment.js` - Stock adjustments

### 5. Seed Script Created
**File:** `seed.js`
- Creates default admin user (username: `admin`, password: `admin123`)
- Creates sample cashier user (username: `cashier`, password: `cashier123`)

---

## ⚠️ Remaining Work: Convert Controllers to ES Modules

The backend uses ES modules (`"type": "module"` in package.json), but controllers still use CommonJS (`require`). You need to update all controllers and routes.

### Files to Update:

#### Controllers (8 files):
1. `controllers/auth.controller.js` ✅ PARTIALLY DONE
2. `controllers/user.controller.js`
3. `controllers/product.controller.js`
4. `controllers/inventory.controller.js`
5. `controllers/sales.controller.js`
6. `controllers/customer.controller.js`
7. `controllers/expense.controller.js`
8. `controllers/dashboard.controller.js`

#### Routes (8 files):
1. `routes/auth.routes.js`
2. `routes/user.routes.js`
3. `routes/product.routes.js`
4. `routes/inventory.routes.js`
5. `routes/sales.routes.js`
6. `routes/customer.routes.js`
7. `routes/expense.routes.js`
8. `routes/dashboard.routes.js`

#### Middleware:
1. `middleware/auth.middleware.js`

#### Utils:
1. `utils/helpers.js`
2. `utils/logger.js`

---

## 🔧 How to Convert Each File

### Pattern for Controllers:

**OLD (CommonJS):**
```javascript
const { query } = require('../config/database');
const logger = require('../utils/logger');
```

**NEW (ES Modules):**
```javascript
import { mongoose } from '../config/database.js';
import logger from '../utils/logger.js';

const User = mongoose.model('User');
// Then replace all query() calls with Mongoose methods
```

### Pattern for Routes:

**OLD:**
```javascript
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
```

**NEW:**
```javascript
import express from 'express';
const router = express.Router();
import controller from '../controllers/auth.controller.js';
```

### Pattern for Helpers:

**OLD:**
```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
```

**NEW:**
```javascript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
```

---

## 📋 Example Controller Conversion

### auth.controller.js - Complete Example

Replace ALL instances of:
```javascript
const result = await query('SELECT * FROM users WHERE username = $1', [username]);
```

With Mongoose:
```javascript
const user = await User.findOne({ username });
```

---

## 🚀 Quick Start After Conversion

### 1. Make Sure MongoDB is Running
```bash
# Windows (if MongoDB installed as service)
net start MongoDB

# Or check if it's running
mongosh
```

### 2. Install Dependencies (Already Done)
```bash
npm install
```

### 3. Seed the Database
```bash
npm run seed
```

This creates:
- Admin user: `admin` / `admin123`
- Cashier user: `cashier` / `cashier123`

### 4. Start Backend
```bash
npm run dev
```

You should see:
```
MongoDB Connected: localhost
Server running in development mode on port 5000
```

### 5. Start Frontend (New Terminal)
```bash
cd ../frontend
npm install
npm run dev
```

### 6. Test Login
- Go to http://localhost:5173
- Login with: `admin` / `admin123`

---

## 🎯 Key Differences: PostgreSQL vs MongoDB

### Queries:

| PostgreSQL | MongoDB/Mongoose |
|------------|------------------|
| `query('SELECT * FROM users')` | `User.find()` |
| `query('SELECT * FROM users WHERE id = $1', [id])` | `User.findById(id)` |
| `query('INSERT INTO users...')` | `User.create(data)` |
| `query('UPDATE users SET...')` | `User.findByIdAndUpdate(id, data)` |
| `query('DELETE FROM users...')` | `User.findByIdAndDelete(id)` |

### Transactions:

**PostgreSQL:**
```javascript
await client.query('BEGIN');
await client.query('COMMIT');
await client.query('ROLLBACK');
```

**MongoDB:**
```javascript
const session = await mongoose.startSession();
session.startTransaction();
await session.commitTransaction();
await session.abortTransaction();
```

---

## 📊 Database Structure Mapping

### PostgreSQL → MongoDB Field Names

MongoDB uses camelCase by convention:

| PostgreSQL (snake_case) | MongoDB (camelCase) |
|-------------------------|---------------------|
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `is_active` | `isActive` |
| `user_id` | `userId` |
| `product_id` | `productId` |

Mongoose automatically handles this with the `timestamps: true` option.

---

## 🔍 Testing the Conversion

### Health Check:
```
GET http://localhost:5000/api/health
```

Should return:
```json
{
  "status": "OK",
  "message": "Server is running",
  "database": "Connected"
}
```

### Test Login:
```
POST http://localhost:5000/api/auth/login
Body: { "username": "admin", "password": "admin123" }
```

---

## 💡 Next Steps

1. **Convert all controllers** to use Mongoose instead of SQL queries
2. **Convert all routes** to ES module imports
3. **Convert middleware** to ES modules
4. **Update helper functions** to ES modules
5. **Test each endpoint** with Postman or similar
6. **Update frontend** API calls if needed (should work as-is)

---

## 🆘 Need Help?

### MongoDB Commands:
```bash
# Show all databases
show dbs

# Use liquor_pos_db
use liquor_pos_db

# Show collections
show collections

# Count users
db.users.countDocuments()

# Find admin user
db.users.findOne({ username: "admin" })
```

### Common Issues:

**Issue:** "Cannot find module"
**Fix:** Add `.js` extension to all imports

**Issue:** "require is not defined"
**Fix:** Convert to ES module imports

**Issue:** "MongoDB not connected"
**Fix:** Check MongoDB is running: `mongosh`

---

## ✅ Conversion Checklist

- [x] Install mongoose
- [x] Update config/database.js
- [x] Update .env file
- [x] Create all Mongoose models
- [x] Create seed script
- [x] Update server.js to ES modules
- [ ] Convert auth.controller.js
- [ ] Convert user.controller.js
- [ ] Convert product.controller.js
- [ ] Convert inventory.controller.js
- [ ] Convert sales.controller.js
- [ ] Convert customer.controller.js
- [ ] Convert expense.controller.js
- [ ] Convert dashboard.controller.js
- [ ] Convert all route files
- [ ] Convert auth.middleware.js
- [ ] Convert helpers.js
- [ ] Convert logger.js
- [ ] Test all endpoints
- [ ] Update documentation

---

**Status:** MongoDB infrastructure ready. Controllers need conversion to Mongoose queries.
