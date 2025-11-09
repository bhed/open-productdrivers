/**
 * Export Button Component
 * Reusable button for exporting data to CSV
 */

'use client';

import { Download } from 'lucide-react';

interface ExportButtonProps<T = unknown> {
  data: T[];
  filename: string;
  formatFunction: (data: T[]) => { headers: string[]; rows: (string | number)[][] };
  label?: string;
}

export function ExportButton<T = unknown>({
  data,
  filename,
  formatFunction,
  label = 'Export CSV',
}: ExportButtonProps<T>) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    const formattedData = formatFunction(data);
    const csv = toCSV(formattedData);
    downloadCSV(csv, filename);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      <Download size={16} />
      <span>{label}</span>
    </button>
  );
}

function toCSV(data: { headers: string[]; rows: (string | number)[][] }): string {
  const csvRows: string[] = [];
  
  csvRows.push(data.headers.map(escapeCSVValue).join(','));
  
  for (const row of data.rows) {
    csvRows.push(row.map(escapeCSVValue).join(','));
  }
  
  return csvRows.join('\n');
}

function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

