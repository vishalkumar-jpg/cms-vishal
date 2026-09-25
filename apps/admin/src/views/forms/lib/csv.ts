import type { FormField, FormSubmission } from "../types";

/** Render an unknown cell value as flat, readable text for a CSV cell. */
const flat = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/**
 * Escape a value for CSV: quote when it contains a comma/quote/newline, double
 * embedded quotes, and neutralise spreadsheet formula-injection by prefixing a
 * leading =,+,-,@ (or tab/CR) with a single quote.
 */
const escapeCsv = (raw: string): string => {
  let v = raw;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
};

/**
 * Build a CSV string from the currently-fetched (filtered) submissions. Columns:
 * submission id + submitted-at + status + spam/read flags + one column per form
 * field + flattened meta (ip/ua/referrer/utm).
 */
export const submissionsToCsv = (fields: FormField[], rows: FormSubmission[]): string => {
  const fieldHeaders = fields.map((f) => f.label || f.name);
  const headers = [
    "submissionId",
    "submittedAt",
    "status",
    "isSpam",
    "isRead",
    ...fieldHeaders,
    "meta.ip",
    "meta.ua",
    "meta.referrer",
    "meta.utm",
  ];

  const lines = rows.map((r) => {
    const cells = [
      r.id,
      new Date(r.createdAt).toISOString(),
      r.status,
      r.isSpam ? "true" : "false",
      r.isRead ? "true" : "false",
      ...fields.map((f) => flat(r.data[f.name])),
      flat(r.meta?.ip),
      flat(r.meta?.ua),
      flat(r.meta?.referrer),
      flat(r.meta?.utm),
    ];
    return cells.map((c) => escapeCsv(c)).join(",");
  });

  return [headers.map(escapeCsv).join(","), ...lines].join("\r\n");
};

/** Trigger a browser download of a CSV string. */
export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
