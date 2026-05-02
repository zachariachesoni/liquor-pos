# Liquor POS Change Report

## Summary

Implemented the requested dashboard, receipt, admin, supplier, inventory, notification, and report-interface changes. The work also removes several repeated or duplicate flows that were causing the same business action to appear in multiple places.

## Completed Changes

- Dashboard now keeps the Trending Product widget, removes the separate Sales Metrics widget, and adds a period selector for Last 7, 14, 30, or 60 days.
- Dashboard now shows average-cost usage details under the Trending Product card for admins/managers, including recent invoice rows, cost used, COGS, units costed, and average buying price.
- The "Welcome back, zach" style username display was removed from the dashboard header, sidebar panel, and admin overview card.
- Sidebar collapse spacing was adjusted so the collapse button no longer overlaps the logo.
- "Thank you for your business" is now only kept in sales receipts/POS receipts and receipt settings. It was removed from customer, expense, supplier GRN, and report exports.
- POS print receipt now uses a hidden print iframe instead of relying on a new popup window, which fixes the checkout print receipt button in browsers that block or mishandle popup printing.
- Business Identity now has Paybill/Till account type and account number fields. POS and sales receipts print the configured payment account.
- Employee creation is now manual: admins enter username, role, and password directly. Email invite/provisioning and temporary-password generation code were removed.
- Inventory Control no longer provides restocking/stock-in controls. It only records stock-out adjustments; incoming stock is handled through Suppliers/GRNs.
- The old `/api/inventory/stock-in` route and manual stock-in controller path were removed.
- Restocking was removed as a selectable expense category so stock purchases are not duplicated outside Suppliers.
- Supplier payment terms now read "Every 7 days", "Every 14 days", etc. instead of "Net 7".
- Supplier detail/modal close buttons are now sticky and accessible inside tall modals.
- Added an admin-only Notifications tab for low-stock and overdue supplier-payment concerns, with "Mark Addressed" handling.
- Supplier/Admin/Inventory/Expenses success and failure messages now use popup toasts instead of inline feedback banners.
- Reports page report-type buttons were converted to a dropdown. Supplier workspace tabs were also converted to a dropdown.
- Report period labels now show the actual month/year or date range instead of generic "This Month".
- "Add Product / Variant" wording was changed to "Add Product"; the create modal now uses "Size" wording.
- Global radius values and modal/card styling were rounded for a softer UI.

## Duplicate / Repeated Feature Audit

- Restocking existed in both Inventory Control and Suppliers. Inventory restocking was removed so Suppliers/GRNs are the single restocking flow.
- Restocking also existed as an expense category, which duplicated supplier purchasing. The UI and backend validation now prevent new restocking expenses.
- Receipt footer text was reused in non-receipt reports and exports. It is now limited to sales receipts.
- Staff onboarding had both manual admin management and email invite provisioning. The invite path was removed and manual password setup is now the single employee-add flow.
- Report navigation used wide button groups. Report selection and supplier workspace selection are now dropdowns to reduce repeated button clutter.
- Inline feedback banners appeared across multiple pages. Active user-action feedback now uses toast popups.

## Functional Impact

Yes, these changes intentionally affect some application behavior:

- Restocking must now be done through Suppliers/GRNs, not Inventory Control or Expenses.
- Adding employees now requires admins to set the password manually; no invite email is sent.
- Receipt printing behavior changed to a more reliable iframe print flow.
- Admins now have a new Notifications page for addressing concerns.
- The Sales Metrics dashboard widget is removed, but trending-product and average-cost detail remain available.

Core POS checkout, product catalog, sales history, reports, suppliers, and inventory viewing remain in place.

## Verification

- `npm run build --prefix frontend` passed.
- Backend JavaScript syntax check passed with `node --check` across backend files.
- `git diff --check` passed.
- Search checks confirmed removed invite helpers, old Net payment labels, old stock-in route labels, "Add Product / Variant", and non-receipt footer usage are no longer present in active app code.

Note: the production build passed. A live browser smoke test was not completed because dev-server start attempts exited before binding to the expected local port.
