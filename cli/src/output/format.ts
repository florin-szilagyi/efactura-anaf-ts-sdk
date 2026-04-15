/**
 * Helpers for human-readable text formatting.
 */

/** Render key-value pairs as aligned columns. */
export function kv(pairs: Array<[string, string | undefined | null]>): string {
  const defined = pairs.filter((p): p is [string, string] => p[1] != null && p[1] !== '');
  if (defined.length === 0) return '';
  const maxKey = Math.max(...defined.map(([k]) => k.length));
  return defined.map(([k, v]) => `${k.padEnd(maxKey)}  ${v}`).join('\n');
}

/** Render an array of objects as a simple aligned table with headers. */
export function table(columns: Array<{ key: string; header: string }>, rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '(none)';

  const widths = columns.map((col) => Math.max(col.header.length, ...rows.map((r) => String(r[col.key] ?? '').length)));

  const headerLine = columns.map((col, i) => col.header.padEnd(widths[i])).join('  ');
  const separator = widths.map((w) => '─'.repeat(w)).join('──');
  const body = rows
    .map((row) => columns.map((col, i) => String(row[col.key] ?? '').padEnd(widths[i])).join('  '))
    .join('\n');

  return `${headerLine}\n${separator}\n${body}`;
}
