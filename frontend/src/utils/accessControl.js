export const ALL_STAFF_ROLES = ['admin', 'manager', 'cashier'];
export const MANAGEMENT_ROLES = ['admin', 'manager'];

export const PRODUCTS_ROUTE_ROLES = ALL_STAFF_ROLES;
export const INVENTORY_ROUTE_ROLES = ALL_STAFF_ROLES;
export const SALES_ROUTE_ROLES = ALL_STAFF_ROLES;

export const canManageCatalog = (role) => MANAGEMENT_ROLES.includes(role);
export const canManageInventory = (role) => MANAGEMENT_ROLES.includes(role);
export const canSeeProductCosts = (role) => MANAGEMENT_ROLES.includes(role);
export const canViewAllSales = (role) => MANAGEMENT_ROLES.includes(role);
