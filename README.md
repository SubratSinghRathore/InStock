# InStock Backend API

Production-ready, modular Express REST API built with TypeScript and MongoDB.

## Features

- **Authentication**: JWT access and refresh token authentication with token rotation, password hashing with bcrypt, role-based authorization (`owner`, `staff`).
- **Business Multi-Tenancy**: Data isolation by business on all queries and mutations.
- **Products**: Full CRUD, category filtering, search, low-stock filter, Cloudinary image upload/cleanup.
- **Inventory Management**: Atomic stock-in, stock-out (with negative-stock prevention constraint), manual adjustments with required reasons, and complete audit movement history.
- **Suppliers**: Full CRUD with product associations.
- **Sales & Returns**: Atomically recorded sales with line items, duplicate prevention / idempotency, and full refunds with stock restoration.
- **Dashboard & Reports**: Real-time inventory metrics, 7-day sales charts, top-selling products, restocking suggestions based on sales velocity and safety buffer, and CSV exports.
- **Image Storage**: Cloudinary integration for product and supplier photos, with signed client upload and fallback backend upload.

## Tech Stack

- Node.js & Express
- TypeScript
- MongoDB & Mongoose
- Zod request validation
- Cloudinary SDK
- Jest & Supertest

## Environment Setup

Create `.env` file from `.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/instock
JWT_ACCESS_SECRET=your_jwt_access_secret_min_32_chars_long
JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_chars_long
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CORS_ORIGIN=*
```

## Running the Backend

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run test suite
npm test

# Build for production
npm run build

# Start production server
npm start
```

## API Documentation

Base URL: `/api/v1`

### Health Check
- `GET /api/v1/health`

### Authentication
- `POST /api/v1/auth/register` - Create business & owner account
- `POST /api/v1/auth/login` - Authenticate user
- `POST /api/v1/auth/refresh-token` - Rotate refresh token
- `POST /api/v1/auth/logout` - Invalidate session
- `GET /api/v1/auth/me` - Current user & business profile

### Products
- `GET /api/v1/products` - List products (supports `search`, `category`, `lowStock`, `page`, `limit`)
- `GET /api/v1/products/categories/list` - Distinct categories
- `GET /api/v1/products/:id` - Product details & recent movements
- `POST /api/v1/products` - Create product
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Archive product

### Inventory
- `POST /api/v1/inventory/stock-in` - Receive stock
- `POST /api/v1/inventory/stock-out` - Issue/dispatch stock (prevents negative stock)
- `POST /api/v1/inventory/adjust` - Manual adjustment (reason required)
- `GET /api/v1/inventory/movements` - Filterable stock movements history

### Suppliers
- `GET /api/v1/suppliers` - List suppliers with product counts
- `GET /api/v1/suppliers/:id` - Supplier details & supplied products
- `POST /api/v1/suppliers` - Create supplier
- `PUT /api/v1/suppliers/:id` - Update supplier
- `DELETE /api/v1/suppliers/:id` - Delete supplier

### Sales
- `POST /api/v1/sales` - Record sale, deduce inventory atomically
- `GET /api/v1/sales` - Query sales transactions
- `GET /api/v1/sales/:id` - Sale receipt details
- `POST /api/v1/sales/:id/return` - Refund sale & restore stock

### Reports & Analytics
- `GET /api/v1/reports/dashboard` - KPI summary, 7-day sales chart, recent movements
- `GET /api/v1/reports/sales-summary` - Revenue, cost, profit, order metrics
- `GET /api/v1/reports/top-products` - Top selling products
- `GET /api/v1/reports/restock-suggestions` - Smart restocking recommendations
- `GET /api/v1/reports/export/inventory-csv` - Export inventory as CSV
- `GET /api/v1/reports/export/sales-csv` - Export sales as CSV

### Business Settings
- `GET /api/v1/business` - Business profile
- `PUT /api/v1/business` - Update business settings

### Image Uploads
- `GET /api/v1/upload/signature` - Get short-lived Cloudinary signature
- `POST /api/v1/upload` - Multipart/form-data image upload (5MB max)
