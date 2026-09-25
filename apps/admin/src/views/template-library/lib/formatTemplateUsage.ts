const COUNT_FORMATTER = new Intl.NumberFormat(undefined);

/** Subtle card copy for starter template usage counts. */
export function formatStarterUsageLabel(totalPages: number | undefined): string | null {
  if (totalPages === undefined || totalPages <= 0) return null;
  return totalPages === 1
    ? "Used on 1 page"
    : `Used on ${COUNT_FORMATTER.format(totalPages)} pages`;
}

/** Relative-friendly usage summary for detail panels. */
export function formatStarterUsageTotal(totalPages: number): string {
  if (totalPages === 0) return "No pages yet";
  return totalPages === 1 ? "1 page" : `${COUNT_FORMATTER.format(totalPages)} pages`;
}
