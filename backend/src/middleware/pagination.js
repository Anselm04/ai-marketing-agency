/**
 * Pagination & Sorting Middleware
 * Parses query params (page, limit, sort, order) and injects pagination
 * metadata into the response.
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Express middleware that parses pagination query params
 * and attaches them to req.pagination.
 */
export function paginationMiddleware(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page, 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const sort = req.query.sort || 'createdAt';
  const order = req.query.order === 'asc' ? 'asc' : 'desc';
  const offset = (page - 1) * limit;

  req.pagination = { page, limit, sort, order, offset };
  next();
}

/**
 * Paginate an array of items (in-memory fallback).
 */
export function paginateArray(items, { page, limit, sort, order }) {
  // Sort
  const sorted = [...items].sort((a, b) => {
    const aVal = a[sort] ?? 0;
    const bVal = b[sort] ?? 0;
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });

  const total = sorted.length;
  const offset = (page - 1) * limit;
  const data = sorted.slice(offset, offset + limit);
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * MongoDB cursor-based pagination helper.
 */
export function buildMongoPagination({ page, limit, sort, order }) {
  return {
    skip: (page - 1) * limit,
    limit,
    sort: { [sort]: order === 'asc' ? 1 : -1 },
  };
}

/**
 * Wrap response with pagination metadata.
 */
export function paginatedResponse(res, data, { page, limit, total }) {
  const totalPages = Math.ceil(total / limit);
  return res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

export default { paginationMiddleware, paginateArray, buildMongoPagination, paginatedResponse };
