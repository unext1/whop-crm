/**
 * Export data to CSV file
 */
export const exportToCSV = <TData>(
  data: TData[],
  options: {
    filename: string;
    headers: string[];
    getRowData: (row: TData) => string[];
  },
) => {
  if (data.length === 0) return;

  const { filename, headers, getRowData } = options;

  const rows = data.map(getRowData);
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
