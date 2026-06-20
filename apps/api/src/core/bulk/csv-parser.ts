// core/bulk/csv-parser.ts · a self-contained RFC-4180 CSV parser (no third-party lib, matching the platform's
// dependency-free ethos). Handles quoted fields with embedded commas / quotes ("") / CR-LF or LF newlines.
// BOUNDED for safety (§4 DoS): caps total rows, fields-per-row, and cell length; a file that exceeds the caps
// throws CsvParseError rather than blowing up memory. Header (first row) is trimmed; data rows are returned as
// raw string[] (the processor maps them to objects + records length/shape mismatches as per-row errors).
import { CsvParseError } from './domain/bulk-import.errors';

export interface ParsedCsv { header: string[]; records: string[][]; }
export interface CsvLimits { maxRows: number; maxFields: number; maxCellLen: number; }
export const DEFAULT_CSV_LIMITS: CsvLimits = { maxRows: 50_000, maxFields: 200, maxCellLen: 10_000 };

export function parseCsv(text: string, limits: CsvLimits = DEFAULT_CSV_LIMITS): ParsedCsv {
  const rows: string[][] = [];
  let field = ''; let row: string[] = []; let inQuotes = false; let started = false;
  const pushField = () => {
    if (field.length > limits.maxCellLen) throw new CsvParseError(`cell exceeds ${limits.maxCellLen} chars`);
    row.push(field); field = '';
    if (row.length > limits.maxFields) throw new CsvParseError(`row exceeds ${limits.maxFields} fields`);
  };
  const pushRow = () => {
    pushField(); rows.push(row); row = []; started = false;
    if (rows.length > limits.maxRows + 1) throw new CsvParseError(`file exceeds ${limits.maxRows} data rows`);
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]; started = true;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;   // CRLF
      pushRow();
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new CsvParseError('unterminated quoted field');
  if (started || field.length > 0 || row.length > 0) pushRow();   // trailing row with no newline

  // Drop a fully-empty trailing row (file ended with a newline).
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  if (rows.length === 0) throw new CsvParseError('empty CSV (no header)');

  const header = rows[0].map((h) => h.trim());
  if (header.some((h) => h === '')) throw new CsvParseError('blank column name in header');
  if (new Set(header).size !== header.length) throw new CsvParseError('duplicate column name in header');
  return { header, records: rows.slice(1) };
}

/** Map a raw record to a {column: value} object using the header; pads short rows, flags over-long ones. */
export function recordToRow(header: string[], record: string[]): { row: Record<string, string>; lengthMismatch: boolean } {
  const row: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) row[header[i]] = (record[i] ?? '').trim();
  return { row, lengthMismatch: record.length !== header.length };
}
