import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({
  currentPage = 1,
  page,
  totalPages = 1,
  onPageChange,
  totalItems = 0,
  limit = 10,
  showPageNumbers = true,
  className = ''
}) => {
  const activePage = page !== undefined ? page : (currentPage || 1);
  const PAGE_SIZE = limit || 10;
  const shouldShowPagination = totalItems > PAGE_SIZE;

  // RULE: If totalItems <= 10, hide pagination completely (return null)
  if (!shouldShowPagination) return null;

  const effectiveTotalPages = Math.max(totalPages, Math.ceil(totalItems / PAGE_SIZE) || 1);

  // Helper to generate page numbers array
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (effectiveTotalPages <= maxVisible) {
      for (let i = 1; i <= effectiveTotalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, activePage - 2);
      let end = Math.min(effectiveTotalPages, start + maxVisible - 1);

      if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`pagination-container flex items-center justify-end gap-4 py-3 border-t border-slate-100 px-4 w-full ${className}`}
    >
      {/* RIGHT ALIGNED PAGINATION CONTROLS */}
      <div className="pagination-controls flex items-center justify-end gap-2 shrink-0 w-full sm:w-auto">
        {/* Previous Button */}
        <button
          type="button"
          disabled={activePage <= 1}
          onClick={() => onPageChange(activePage - 1)}
          className="pagination-button pagination-previous inline-flex flex-row items-center justify-center gap-1.5 whitespace-nowrap shrink-0 min-w-[95px] h-9 px-3.5 text-xs font-semibold border border-slate-200/90 rounded-xl bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 shadow-2xs cursor-pointer"
          aria-label="Previous Page"
        >
          <ChevronLeft className="pagination-arrow w-3.5 h-3.5 shrink-0" />
          <span>Previous</span>
        </button>

        {/* Page Numbers or Page Indicator */}
        {showPageNumbers && effectiveTotalPages > 1 ? (
          <div className="hidden sm:flex items-center gap-1.5">
            {pageNumbers[0] > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onPageChange(1)}
                  className="min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  1
                </button>
                {pageNumbers[0] > 2 && (
                  <span className="w-8 h-9 flex items-center justify-center text-xs text-slate-400 font-bold">...</span>
                )}
              </>
            )}

            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                  p === activePage
                    ? 'bg-teal-600 text-white font-bold shadow-xs ring-1 ring-teal-600/30'
                    : 'border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-2xs'
                }`}
              >
                {p}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < effectiveTotalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < effectiveTotalPages - 1 && (
                  <span className="w-8 h-9 flex items-center justify-center text-xs text-slate-400 font-bold">...</span>
                )}
                <button
                  type="button"
                  onClick={() => onPageChange(effectiveTotalPages)}
                  className="min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  {effectiveTotalPages}
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* Mobile Page Indicator fallback */}
        <div className="sm:hidden text-xs font-medium text-slate-600 px-2 shrink-0">
          Page {activePage} of {effectiveTotalPages}
        </div>

        {/* Next Button */}
        <button
          type="button"
          disabled={activePage >= effectiveTotalPages}
          onClick={() => onPageChange(activePage + 1)}
          className="pagination-button pagination-next inline-flex flex-row items-center justify-center gap-1.5 whitespace-nowrap shrink-0 min-w-[95px] h-9 px-3.5 text-xs font-semibold border border-slate-200/90 rounded-xl bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 shadow-2xs cursor-pointer"
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight className="pagination-arrow w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
