import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function splitCsvLine(line: string): string[] {
  const values = line.match(/(?:"([^"]*)"|([^,]+)|)(?=,|$)/g) || [];
  return values.map((value) => value.replace(/^"|"$/g, '').trim());
}

export function parseCsv<T extends Record<string, string>>(relativePath: string): T[] {
  // Only use the filename — strip any directory prefix
  const fileName = relativePath.replace(/^.*[\\/]/, '');

  // Try both possible locations depending on what cwd Playwright uses
  const candidates = [
    resolve(process.cwd(), 'data', fileName),                // cwd = automation/
    resolve(process.cwd(), 'automation', 'data', fileName),  // cwd = project root
  ];

  let fullPath = '';
  for (const candidate of candidates) {
    try {
      readFileSync(candidate);
      fullPath = candidate;
      break;
    } catch {
      // not here, try next
    }
  }

  if (!fullPath) {
    throw new Error(
      `[CSV PARSER] Could not find "${fileName}" in any of:\n` +
      candidates.map(c => `  - ${c}`).join('\n')
    );
  }

  console.log('[CSV PARSER] Found at:', fullPath);

  const rawFile = readFileSync(fullPath, 'utf-8').trim();
  const lines = rawFile.split(/\r?\n/).filter(Boolean);

  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines.shift()!);
  return lines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || '';
      return record;
    }, {} as Record<string, string>) as T;
  });
}