import { LoadingSpinner } from "./loading-spinner";
import { EmptyState } from "./empty-state";

export interface Column<T = any> {
  header: string | React.ReactNode | (({ table }: any) => React.ReactNode);
  accessorKey?: keyof T;
  id?: string;
  cell?: ({ row }: { row: { original: T } }) => React.ReactNode;
}

interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T = any>({ 
  data, 
  columns, 
  loading = false,
  emptyMessage = "Nessun dato disponibile"
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          title="Nessun risultato"
          description={emptyMessage}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" data-testid="data-table">
        <thead className="bg-muted">
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.id || column.accessorKey?.toString() || index}
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {typeof column.header === 'function' 
                  ? column.header({ table: { data } })
                  : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {data.map((item, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-muted/50">
              {columns.map((column, colIndex) => (
                <td
                  key={column.id || column.accessorKey?.toString() || colIndex}
                  className="px-6 py-4 whitespace-nowrap"
                  data-testid={`cell-${rowIndex}-${colIndex}`}
                >
                  {column.cell ? 
                    column.cell({ row: { original: item } }) : 
                    column.accessorKey ? 
                      String(item[column.accessorKey] || '') : 
                      null
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
