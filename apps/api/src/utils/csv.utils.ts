/**
 * CSV helpers — formula-injection-safe (OWASP "CSV injection"). Any cell that
 * begins with =, +, -, @, tab or CR is prefixed with a single quote so a
 * spreadsheet never evaluates it as a formula. Values are always quoted and
 * internal quotes are doubled.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(value: unknown): string {
  let str = value == null ? "" : String(value);
  if (FORMULA_TRIGGER.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Build a CSV string from a header row + records (object → header-keyed cells). */
export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const head = headers.map(sanitizeCsvCell).join(",");
  const body = rows
    .map((row) => headers.map((h) => sanitizeCsvCell(row[h])).join(","))
    .join("\r\n");
  return body ? `${head}\r\n${body}` : head;
}

/**
 * Minimal CSV parser for bulk imports: handles quoted fields, doubled quotes and
 * CRLF/LF line endings. Returns an array of row objects keyed by the header row.
 */
export function parseCsv(input: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}
