import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <nav className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginacao">
      <Button className="w-full sm:w-auto" variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)} icon={<ChevronLeft size={18} aria-hidden="true" />} aria-label="Pagina anterior">
        Anterior
      </Button>
      <span className="text-center text-sm text-slate-600" aria-live="polite">
        Pagina {page} de {totalPages}
      </span>
      <Button className="w-full sm:w-auto" variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} icon={<ChevronRight size={18} aria-hidden="true" />} aria-label="Proxima pagina">
        Proxima
      </Button>
    </nav>
  );
}
