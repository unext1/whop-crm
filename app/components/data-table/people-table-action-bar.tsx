import type { Table } from '@tanstack/react-table';
import { Download, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';
import { GenericTableActionBar, type TableActionConfig } from '~/components/data-table/table-action-bar';
import { exportToCSV } from '~/utils/export-csv';

// Type constraint matching PeopleWithCompany structure
// emails array items have required fields: id, type, isPrimary
// company object has required fields: id, name
type PersonRow = {
  id: string;
  name: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  whopUserId?: string | null;
  emails?: Array<{
    id: string;
    email: string;
    type: string | null;
    isPrimary: boolean | null;
  }>;
  company?: {
    id: string;
    name: string;
  };
} & Record<string, unknown>; // Allow additional fields from PeopleType

interface PeopleTableActionBarProps<TData extends PersonRow> {
  table: Table<TData>;
}

export const PeopleTableActionBar = <TData extends PersonRow>({ table }: PeopleTableActionBarProps<TData>) => {
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
          filename: 'people-export',
          headers: ['Name', 'Job Title', 'Company', 'All Emails', 'Phone', 'Address', 'Website'],
          getRowData: (person) => {
            const allEmails = person.emails?.map((e) => e.email).join('; ') || '';
            return [
              person.name || '',
              person.jobTitle || '',
              person.company?.name || '',
              allEmails,
              person.phone || '',
              person.address || '',
              person.website || '',
            ];
          },
        },
      );
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'person' : 'people'}`);
    } catch {
      toast.error('Failed to export people');
    } finally {
      setIsExporting(false);
    }
  }, [rows]);

  const handleDelete = React.useCallback(() => {
    if (rows.length === 0) return;

    const personIds = rows.map((row) => row.original.id).filter(Boolean);

    if (personIds.length === 0) {
      toast.error('No valid people selected');
      return;
    }

    const formData = new FormData();
    formData.append('intent', 'deletePeople');
    personIds.forEach((id) => {
      formData.append('personIds', id);
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
      tooltip: 'Export people',
      onClick: handleExport,
      isPending: isExporting,
    },
    {
      id: 'delete',
      icon: Trash2,
      tooltip: 'Delete people',
      onClick: handleDelete,
      isPending: deleteFetcher.state === 'submitting',
    },
  ];

  return <GenericTableActionBar table={table} actions={actions} />;
};
