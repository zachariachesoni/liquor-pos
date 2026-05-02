# Duplicate Feature Cleanup Report

Date: 2026-05-02

## Scope

This pass focused on duplicate or repeated features that were safe to clean up without removing active business workflows. Operational/reporting overlaps that users likely depend on are documented below instead of being deleted.

## Changes Completed

### Employee management

- Removed the unused `frontend/src/pages/Employees.jsx` page.
- Removed the duplicate `/employees` route from `frontend/src/App.jsx`.
- `frontend/src/pages/AdminPanel.jsx` is now the single staff/account management surface.

### Backend Vite scaffold

- Removed the unused backend Vite starter files:
  - `backend/index.html`
  - `backend/src`
- Removed `vite` from `backend/package.json` and regenerated `backend/package-lock.json` with `npm uninstall vite --save-dev`.
- The backend now only carries server dependencies.

### Average cost calculation

- Added `backend/utils/inventoryCost.js`.
- Moved weighted average cost calculation into that shared utility.
- Updated inventory stock changes and purchase receiving to use the same cost rule.
- Refactored stock-in and manual stock adjustment handling through shared inventory write helpers so stock-in no longer carries its own copy of the stock/cost update flow.

### Product snapshot analytics

- Added `backend/utils/productSnapshot.js`.
- Updated dashboard and report controllers to use the same product snapshot formatter.
- This reduces drift between dashboard trending product data and reporting product rows.

### Dashboard API routes

- Removed duplicate dashboard aliases that all returned the same full stats payload:
  - `/api/dashboard/sales-trend`
  - `/api/dashboard/top-products`
  - `/api/dashboard/profit-summary`
  - `/api/dashboard/category-performance`
- Kept `/api/dashboard/stats` as the canonical dashboard metrics endpoint.
- Frontend usage already points to `/api/dashboard/stats`.

### Sales today route

- Updated `/api/sales/today` so it now applies an actual current-day date window.
- `/api/sales` remains the general sales history endpoint.

## Intentional Overlaps Left In Place

### Inventory reorder suggestions and supplier receiving

Inventory still allows draft PO creation from reorder suggestions, while Suppliers remains the full PO/GRN workspace. This is useful as a shortcut plus a detailed receiving workflow.

Recommended future refinement: after creating a draft PO from Inventory, route the user into the Suppliers receiving workspace for continuation.

### Sales, Customers, and Reports

These screens all expose sales data, but from different user tasks:

- Sales: transaction lookup, invoice download, and sale detail.
- Customers: customer-level purchase timeline.
- Reports: exportable period, customer, and product analytics.

Recommended future refinement: rename customer export actions so they read as customer timelines rather than full reporting modules.

### Expenses and P&L reports

Expenses keeps the operational expense ledger and budget views. Reports keeps the financial statement view.

Recommended future refinement: keep expense entry and budgeting in Expenses, and reserve Reports for summarized/exportable financial statements.

## Follow-Up Candidates

- Extract more dashboard/report aggregation logic into a dedicated analytics service if the same trending product or sales-period rules need to stay identical across screens.
- Add route-level tests for `/api/dashboard/stats`, `/api/sales/today`, `/api/inventory/stock-in`, and `/api/inventory/adjustments`.
- Add focused unit coverage for `calculateWeightedAverageCost`.
