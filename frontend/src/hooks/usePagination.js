import { useState, useMemo, useEffect } from 'react';

/**
 * Custom hook for standardizing table/list pagination across CareFlow.
 * Defaults to 10 items per page.
 */
export function usePagination(items = [], initialLimit = 10) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  const totalItems = Array.isArray(items) ? items.length : 0;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Reset to page 1 if page exceeds totalPages when items change
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(1);
    }
  }, [totalItems, totalPages, page]);

  const paginatedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const start = (page - 1) * limit;
    return items.slice(start, start + limit);
  }, [items, page, limit]);

  const resetPage = () => setPage(1);

  const startIndex = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, totalItems);

  return {
    page,
    currentPage: page,
    setPage,
    goToPage: setPage,
    limit,
    setLimit,
    totalItems,
    totalResults: totalItems,
    totalPages,
    paginatedItems,
    currentData: paginatedItems,
    resetPage,
    startIndex,
    endIndex
  };
}

export default usePagination;
