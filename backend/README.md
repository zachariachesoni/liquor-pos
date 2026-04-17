# Liquor POS Backend

Express and MongoDB API for the Liquor POS system.

## Stack

- Node.js
- Express
- MongoDB with Mongoose
- JWT authentication
- Winston and Morgan logging

## Environment Variables

Create `backend/.env` for local development:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/liquor_pos_db
JWT_SECRET=change_this_in_production
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:5173

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
MAIL_FROM=Liquor POS Admin <your-email@example.com>
```

The backend accepts either `MONGODB_URI` or `MONGO_URI`.

## Local Run

```bash
npm install
npm run dev
```

Production run:

```bash
npm install
npm start
```

Health check:

```text
GET /api/health
```

## Main API Areas

- `/api/auth`
- `/api/users`
- `/api/products`
- `/api/inventory`
- `/api/sales`
- `/api/customers`
- `/api/expenses`
- `/api/dashboard`
- `/api/reports`
- `/api/settings`

## Deployment Notes

For DigitalOcean App Platform:

- source directory: `backend`
- build command: `npm install`
- run command: `npm start`
- port: `8080`

Required production env vars:

- `MONGODB_URI` or `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL`

Optional but recommended:

- `JWT_EXPIRE`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

## Current Behavior

- Public registration is only available for first-run bootstrap.
- The first registered user becomes `admin`.
- Additional staff accounts must be created by an admin.
- Sales persist `amount_paid` and `change_due`.
- Inventory rejects negative stock adjustments.
- Settings control business branding and low-stock policy.
