export const PAGE_SIZE = 10;

export function paginateRows<T>(rows: T[], currentPage: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize),
    totalPages,
    safePage,
    pageSize,
  };
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  label,
  onPageChange,
  pageSize = PAGE_SIZE,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  label: string;
  onPageChange: (page: number) => void;
  pageSize?: number;
}) {
  if (totalItems <= pageSize) {
    return null;
  }

  return (
    <div className="pagination-bar">
      <div className="pagination-note">
        Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalItems)}-{Math.min(currentPage * pageSize, totalItems)} de {totalItems} {label}
      </div>
      <div className="pagination-actions">
        <button className="btn-secondary-soft" type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
          Anterior
        </button>
        <span className="pagination-page">Pagina {currentPage} de {totalPages}</span>
        <button className="btn-secondary-soft" type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
