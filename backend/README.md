# Liquor POS & Inventory Management System - Backend API

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)

### Installation Steps

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Environment Variables**

Edit the `.env` file with your database credentials:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=liquor_pos_db
DB_USER=postgres
DB_PASSWORD=your_password_here

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:5173
```

3. **Set Up Database**

Run the SQL schema file in PostgreSQL:
```bash
psql -U postgres -f database/schema.sql
```

Or manually execute the contents of `database/schema.sql` in pgAdmin or your preferred PostgreSQL client.

4. **Start the Server**

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/logout` - Logout user (protected)

### Users (Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin/Manager)
- `PUT /api/products/:id` - Update product (Admin/Manager)
- `DELETE /api/products/:id` - Delete product (Admin)
- `POST /api/products/:productId/variants` - Add variant (Admin/Manager)
- `PUT /api/products/variants/:id` - Update variant (Admin/Manager)
- `DELETE /api/products/variants/:id` - Delete variant (Admin)

### Inventory
- `GET /api/inventory/stock-levels` - Get current stock levels
- `GET /api/inventory/low-stock` - Get low stock items
- `GET /api/inventory/history` - Get stock movement history
- `POST /api/inventory/stock-in` - Add stock (Admin/Manager)
- `POST /api/inventory/adjustments` - Record adjustment (Admin/Manager)

### Sales (POS)
- `POST /api/sales` - Create new sale (checkout)
- `GET /api/sales` - Get all sales (with filters)
- `GET /api/sales/:id` - Get sale details
- `GET /api/sales/today` - Get today's sales summary
- `POST /api/sales/:id/refund` - Process refund (Admin/Manager)

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create customer (Admin/Manager)
- `PUT /api/customers/:id` - Update customer (Admin/Manager)
- `DELETE /api/customers/:id` - Delete customer (Admin)
- `GET /api/customers/:id/purchase-history` - Get purchase history

### Expenses
- `GET /api/expenses` - Get all expenses
- `GET /api/expenses/categories` - Get expense categories
- `POST /api/expenses` - Record expense (Admin/Manager)
- `PUT /api/expenses/:id` - Update expense (Admin/Manager)
- `DELETE /api/expenses/:id` - Delete expense (Admin)

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/sales-trend` - Get 30-day sales trend
- `GET /api/dashboard/top-products` - Get top selling products
- `GET /api/dashboard/profit-summary` - Get profit summary
- `GET /api/dashboard/category-performance` - Get category performance

## Authentication

All endpoints (except login/register) require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## User Roles

- **Admin**: Full access to all features
- **Manager**: Can manage products, inventory, sales, customers, expenses (cannot manage users)
- **Cashier**: Can only create sales and view products

## Key Features

### Dual Pricing System
- Automatic wholesale pricing when quantity >= threshold
- Retail pricing by default
- Configurable wholesale threshold per product variant

### Stock Management
- Real-time stock tracking
- Low stock alerts
- Manual stock adjustments with reason logging
- Complete stock movement history

### Sales Analytics
- Daily/Weekly/Monthly sales reports
- Profit margin calculations
- Top-selling products
- Category performance analysis

## Default Admin Account

After running the schema, you can login with:
- Username: `admin`
- Password: You'll need to set a proper password using bcrypt hash

(For security, update the admin password hash in the database before production use)

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists

### Port Already in Use
- Change PORT in `.env`
- Or kill process using port 5000

### Module Not Found
- Run `npm install` again
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

## Logging

Logs are stored in the `logs/` directory:
- `error.log` - Error level logs only
- `combined.log` - All logs

## Security Notes

- Change JWT_SECRET in production
- Use HTTPS in production
- Implement rate limiting for production
- Regular database backups
- Keep dependencies updated
