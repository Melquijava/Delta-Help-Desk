import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  hideOnMobile?: boolean;
};

type DataTableProps<T> = {
  columns: Array<Column<T>>;
  data: T[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataTable<T>({ columns, data, emptyTitle, emptyDescription }: DataTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle ?? 'Nenhum registro encontrado'} description={emptyDescription ?? 'Os dados aparecerao aqui quando estiverem disponiveis.'} />;
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {data.map((row, rowIndex) => (
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm" key={rowIndex}>
            <dl className="space-y-3">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div className="grid gap-1" key={column.key}>
                    <dt className="text-xs font-semibold uppercase text-slate-500">{column.header}</dt>
                    <dd className="min-w-0 text-sm text-slate-800">{column.render(row)}</dd>
                  </div>
                ))}
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3" key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {data.map((row, index) => (
            <tr className="hover:bg-slate-50" key={index}>
              {columns.map((column) => (
                <td className="px-4 py-3" key={column.key}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </>
  );
}
