# StockPilot: Inventory and Sales Management

An inventory, sales and purchase management system. It covers products, stock, sales, payments, customer dues, purchases, reports, and role-based access for users.

## Tech stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express 5, Mongoose 9, JWT, bcryptjs
- **Database:** MongoDB Atlas
- **Deploy:** Frontend on Vercel, backend on Render

## Main features

- Products, categories and brands
- Bulk product import from a CSV file (with a preview before saving)
- Stock, stock history and low-stock alerts
- Purchases: draft, complete (stock increases) and cancel
- Sales: draft, complete (stock decreases and purchase cost is saved) and cancel
- Payments (partial or full) and customer dues
- Customer and supplier management
- Returns: customer returns (balance adjustment and cash refund) and returns to suppliers
- Reports: sales, purchases, profit and stock value, with a date range
- Users and roles: Administrator, Manager and Staff
- Users can change their own email and password
- Administrators can edit users, and set a temporary password for a user who forgot theirs
- Audit log of important changes
- Light and dark mode

## Roles and permissions

| Task | Administrator | Manager | Staff |
|---|---|---|---|
| View products, categories, brands, stock and customers | ✅ | ✅ | ✅ |
| Add and edit products | ✅ | ✅ | ❌ |
| Add and edit categories and brands | ✅ | ✅ | ❌ |
| Adjust stock | ✅ | ✅ | ❌ |
| Create, complete and collect payment for sales | ✅ | ✅ | ✅ |
| Cancel sales | ✅ | ✅ | ❌ |
| View, create, complete and cancel purchases | ✅ | ✅ | ❌ |
| Add customers | ✅ | ✅ | ✅ |
| Edit customers and activate or deactivate them | ✅ | ✅ | ❌ |
| Add and edit suppliers | ✅ | ✅ | ❌ |
| Customer returns and returns to suppliers | ✅ | ✅ | ❌ |
| Reports and the payment and dues list | ✅ | ✅ | ❌ |
| User management and audit log | ✅ | ❌ | ❌ |

Every user can change their own email and password from the gear icon at the bottom of the sidebar.

## Run locally

Requirements: Node.js and pnpm.

**1. Frontend**

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Then open `http://localhost:3000`.

**2. Backend**

```bash
cd server
pnpm install
cp .env.example .env
pnpm dev
```

Set `MONGO_URI` and `JWT_SECRET` in `.env` to your own values. When the backend is running, opening `http://localhost:5000/api/v1/health` shows a message.

## Create the first Administrator

From the `server` folder:

```bash
node src/scripts/createAdmin.js "Your name" admin@example.com "a-strong-password"
```

The password must be at least 8 characters. Run this command only once.

## Import products from a CSV file

From the `server` folder. The first run only checks the file and shows a preview. Nothing is saved.

```bash
node src/scripts/importProducts.js "C:\path\to\products.csv" "admin@example.com"
```

When the preview is correct, add `--apply` to save the products:

```bash
node src/scripts/importProducts.js "C:\path\to\products.csv" "admin@example.com" --apply
```

The first row of the CSV must be the header:

```csv
name,sku,category,brand,purchase_price,selling_price,min_stock_level,opening_stock,unit
```

`category` and `brand` must match existing names exactly. Each `sku` must be unique. `opening_stock` is recorded in the stock history as the opening stock.

## Deploy

- **Frontend (Vercel):** Add the environment variable `NEXT_PUBLIC_API_BASE_URL`, then redeploy.
- **Backend (Render):** Root Directory `server`, Build Command `pnpm install`, Start Command `pnpm start`. Environment variables: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `CLIENT_URL` (the Vercel address).

The free Render server sleeps when it is not used. The first request can take 2 to 3 minutes.

## Known limitations

- A saved return cannot be cancelled.
- Cash refunds do not appear in the payment list. They are shown on the Returns page and in the reports.
- Payments to suppliers are not tracked yet.
- Walk-in sales cannot be linked to a person, so their dues cannot be tracked to an individual.
- Reports use UTC dates. Sales made before 6 AM Bangladesh time may appear on the previous day.
- Sign-in is stored per browser tab (`sessionStorage`), so each tab needs its own sign-in.

## Project structure

app/ Next.js pages and layout
components/ One module per screen (products, sales, customers, ...)
lib/ API client (api.ts) and money formatting (money.ts)
server/src/
config/ MongoDB connection
controllers/ Business logic
middleware/ Sign-in and role checks
models/ Mongoose schemas
routes/ API paths
scripts/ First Administrator and CSV product import
utils/ Audit log

