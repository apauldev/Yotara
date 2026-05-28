export interface CsvColumn<T> {
  key: keyof T;
  label: string;
  format?: (row: T) => string;
}

export function downloadCsv<T>(data: T[], columns: CsvColumn<T>[], filename: string): void {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = col.format ? col.format(row) : String(row[col.key] ?? '');
        return escapeCsvValue(value);
      })
      .join(','),
  );
  const bom = '\uFEFF';
  const csv = bom + header + '\n' + rows.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadJson<T>(data: T[], filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
