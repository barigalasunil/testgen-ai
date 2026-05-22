import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function splitCsvLine(line: string): string[] {
  const values = line.match(/(?:"([^"]*)"|([^,]+)|)(?=,|$)/g) || [];
  return values.map((value) => value.replace(/^"|"$/g, '').trim());
}

export function parseCsv<T extends Record<string, string>>(relativePath: string): T[] {
  const fullPath = resolve(__dirname, relativePath);
  const rawFile = readFileSync(fullPath, 'utf-8').trim();
  const lines = rawFile.split(/\r?\n/).filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines.shift()!);
  return lines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || '';
      return record;
    }, {} as Record<string, string>) as T;
  });
}
