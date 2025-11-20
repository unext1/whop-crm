import type { Table } from '@tanstack/react-table';
import { Download, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';
import { GenericTableActionBar, type TableActionConfig } from '~/components/data-table/table-action-bar';
import type { companiesTable } from '~/db/schema';
import { exportToCSV } from '~/utils/export-csv';

type CompanyRow = typeof companiesTable.$inferSelect;

interface CompaniesTableActionBarProps<TData extends CompanyRow> {
  table: Table<TData>;
}

export function CompaniesTableActionBar<TData extends CompanyRow>({ table }: CompaniesTableActionBarProps<TData>) {
  const rows = table.getFilteredSelectedRowModel().rows;
  const deleteFetcher = useFetcher();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = React.useCallback(() => {
    if (rows.length === 0) return;

    setIsExporting(true);
    try {
      exportToCSV(
        rows.map((row) => row.original),
        {
          filename: 'companies-export',
          headers: ['Name', 'Domain', 'Industry', 'Phone', 'Address', 'Website'],
          getRowData: (company) => [
            company.name || '',
            company.domain || '',
            company.industry || '',
            company.phone || '',
            company.address || '',
            company.website || '',
          ],
        },
      );
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'company' : 'companies'}`);
    } catch {
      toast.error('Failed to export companies');
    } finally {
      setIsExporting(false);
    }
  }, [rows]);

  const handleDelete = React.useCallback(() => {
    if (rows.length === 0) return;

    const companyIds = rows.map((row) => row.original.id).filter(Boolean);

    if (companyIds.length === 0) {
      toast.error('No valid companies selected');
      return;
    }

    const formData = new FormData();
    formData.append('intent', 'deleteCompanies');
    companyIds.forEach((id) => {
      formData.append('companyIds', id);
    });

    deleteFetcher.submit(formData, {
      method: 'post',
    });

    // Optimistically clear selection
    table.toggleAllRowsSelected(false);
  }, [rows, table, deleteFetcher]);

  const actions: TableActionConfig<TData>[] = [
    {
      id: 'export',
      icon: Download,
      tooltip: 'Export companies',
      onClick: handleExport,
      isPending: isExporting,
    },
    {
      id: 'delete',
      icon: Trash2,
      tooltip: 'Delete companies',
      onClick: handleDelete,
      isPending: deleteFetcher.state === 'submitting',
    },
  ];

  return <GenericTableActionBar table={table} actions={actions} />;
}
