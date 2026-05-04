import { ChevronLeft, ChevronRight } from 'lucide-react';

const PaginationControls = ({
  totalItems = 0,
  pageSize = 10,
  currentPage = 1,
  onPageChange,
  label = 'records'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) {
    return null;
  }

  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startItem = ((safePage - 1) * pageSize) + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  const changePage = (page) => {
    if (!onPageChange) return;
    onPageChange(Math.min(Math.max(page, 1), totalPages));
  };

  return (
    <div className="pagination-controls">
      <span>
        Showing {startItem}-{endItem} of {totalItems} {label}
      </span>
      <div className="pagination-actions">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => changePage(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="pagination-page">Page {safePage} of {totalPages}</span>
        <button
          type="button"
          className="pagination-btn"
          onClick={() => changePage(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;
