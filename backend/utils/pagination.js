export const getPagination = (query = {}, defaultLimit = 25, maxLimit = 100) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedLimit = Number.parseInt(query.limit, 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : defaultLimit));
  const enabled = query.page !== undefined || query.limit !== undefined;

  return {
    enabled,
    page,
    limit,
    skip: (page - 1) * limit
  };
};

export const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  total_pages: Math.max(1, Math.ceil(Number(total || 0) / limit))
});
