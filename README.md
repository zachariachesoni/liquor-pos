# Liquor POS & Inventory Management System

A comprehensive Point of Sale and Inventory Management System built specifically for liquor stores, featuring dual pricing (retail/wholesale), variant tracking by bottle size, and powerful analytics.

![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20MongoDB-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Features

### Core Modules (MVP)

#### ✅ POS (Sales System)
- Fast checkout with barcode/manual search
- Retail vs Wholesale pricing auto-switch
- Shopping cart system
- Multiple payment methods (Cash, M-Pesa, Bank)
- Receipt generation

#### ✅ Inventory Management
- Product & variant management (by size: 250ml, 500ml, 750ml, 1L, etc.)
- Real-time stock tracking
- Stock in/out management
- Minimum stock alerts
- Manual adjustments with reason logging

#### ✅ Expenses Tracking
- Record business expenses
- Categorization (Rent, Salaries, Transport, Restocking)
- Payment method tracking
- Expense reports

#### ✅ Basic Reports
- Daily/Weekly/Monthly sales
- Profit calculations
- Stock level reports
- Category performance

### Smart Features (Phase 2)

#### 🎯 Dual Pricing System
- Each variant has retail and wholesale prices
- Automatic price switching based on quantity threshold
- Configurable wholesale threshold per product

#### 📊 Volume Intelligence
- Bottle-level tracking (simple approach)
- Future upgrade: ml-based liquid tracking across sizes

#### ⚙️ Stock Adjustment System
- Manual adjustments for breakage, theft, spoilage
- Reason logging with categories
- Complete audit trail

### Analytics (Phase 3)

#### 📈 Sales Analytics
- Best-selling brands and sizes
- Peak hours/days analysis
- Retail vs wholesale comparison

#### 💰 Profit Analytics
- Per-product margin tracking
- Total profit over time
- Expense vs revenue breakdown

#### 🔍 Inventory Insights
- Fast-moving vs slow-moving stock
- Dead stock alerts
- Reorder suggestions

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, Rate Limiting
- **Logging**: Winston, Morgan

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Routing**: React Router v7
- **HTTP Client**: Axios
- **State Management**: Context API

## 📦 Installation

### Prerequisites
- Node.js v18+
- MongoDB v6+
- npm or yarn

### 1. Clone or Download Project

Navigate to your project folder:
```
c:\Users\zacha\Desktop\zach docs\liquor-pos-system
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Configure environment variables in `.env`:
```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/liquor_pos_db

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:5173
```

Make sure MongoDB is running locally, or point `MONGODB_URI` to your hosted cluster.

Start backend server:
```bash
npm run dev
```

Server runs on: http://localhost:5000

### 3. Frontend Setup

Open new terminal:
```bash
cd frontend
npm install
```

Start development server:
```bash
npm run dev
```

Frontend runs on: http://localhost:5173

## 📚 Database Schema

### Main Tables

1. **Products** - Master product catalog
2. **Product Variants** - Size variants with individual pricing and stock
3. **Customers** - Customer database
4. **Sales** - Sales transactions header
5. **Sale Items** - Individual items in each sale
6. **Expenses** - Business expense tracking
7. **Stock Adjustments** - Manual stock changes
8. **Users** - System users with roles

### Product Structure Example

```
Product: Johnnie Walker Black Label
├── Variant: 250ml
│   ├── Buying Price: KES 500
│   ├── Retail Price: KES 800
│   ├── Wholesale Price: KES 700
│   └── Wholesale Threshold: 12 bottles
├── Variant: 500ml
│   ├── Buying Price: KES 900
│   ├── Retail Price: KES 1,500
│   └── Wholesale Price: KES 1,300
├── Variant: 750ml
│   └── ...
└── Variant: 1L
    └── ...
```

## 🔐 User Roles

- **Admin** - Full system access including user management
- **Manager** - Manage products, inventory, sales, customers, expenses, and reports
- **Cashier** - POS operations only

Initial setup:
- The `/register` screen can only be used when there are no users yet.
- It creates the first `admin` account.
- After that, all additional staff accounts must be created by an admin from the Employees screen.

## 🎯 Key Features Explained

### Dual Pricing Logic

```javascript
// Automatic wholesale pricing
if (quantity >= variant.wholesale_threshold) {
  price = variant.wholesale_price;
  sale_type = 'wholesale';
} else {
  price = variant.retail_price;
  sale_type = 'retail';
}
```

### Stock Management

- Real-time deduction on sale
- Manual adjustments with reasons
- Low stock alerts when `current_stock <= min_stock_level`
- Complete movement history

### Security Features

- Password hashing (bcrypt)
- JWT authentication
- Role-based access control
- XSS protection
- Rate limiting

## 📖 API Endpoints

See [backend/README.md](backend/README.md) for complete API documentation.

Key endpoints:
- `/api/auth/*` - Authentication
- `/api/products/*` - Product management
- `/api/inventory/*` - Inventory operations
- `/api/sales/*` - Sales/POS
- `/api/dashboard/*` - Analytics

## 🚀 Usage Guide

### First Time Setup

1. Start MongoDB
2. Create the initial admin account from `/register`
3. Start backend: `npm run dev`
4. Start frontend: `npm run dev`
5. Login with the admin credentials you created
6. Add your first product with variants
7. Set initial stock levels
8. Start making sales!

### Daily Operations

**Cashier Workflow:**
1. Login to POS
2. Search/add products to cart
3. System auto-applies wholesale pricing for bulk orders
4. Select payment method
5. Complete sale and print receipt

**Manager Workflow:**
1. Monitor dashboard for daily stats
2. Check low stock alerts
3. Restock inventory as needed
4. Review sales reports
5. Record expenses

## 🔧 Development

### Backend Scripts
```bash
npm run dev      # Development with auto-reload
npm start        # Production mode
```

### Frontend Scripts
```bash
npm run dev      # Development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## 📝 Future Enhancements

- [ ] M-Pesa API integration
- [ ] Barcode generator
- [ ] PDF/Excel report export
- [ ] Email notifications for low stock
- [ ] Multi-store support
- [ ] Customer loyalty program
- [ ] Mobile app (React Native)
- [ ] Offline mode
- [ ] Volume-based intelligence (ml tracking)

## 🐛 Troubleshooting

### Database Connection Error
- Verify MongoDB is running
- Check `MONGODB_URI` in `.env`
- Ensure the target database is reachable

### Port Already in Use
- Change PORT in backend `.env`
- Or kill process using port 5000/5173

### Module Not Found
- Run `npm install` in both directories
- Clear cache: `rm -rf node_modules && npm install`

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 👨‍💻 Support

For issues or questions:
1. Check this README
2. Review backend/README.md for API details
3. Check application logs in `backend/logs/`

## 🎉 Success!

You now have a fully functional Liquor POS & Inventory Management System! The backend API is complete with all endpoints, and the frontend provides a solid foundation that can be expanded with full UI components for each module.

Happy selling! 🍾📊
