import { serializeLd } from "@/lib/structured-data";
import { suppressStructuredDataForDeployment } from "@/lib/indexing-policy";

/**
 * Renders schema.org JSON-LD as a single `<script type="application/ld+json">`.
 * Server component (no client hooks) so the structured data is present in the
 * SSR HTML for crawlers. Multiple objects are emitted as a JSON array.
 * UAT/staging deployments suppress JSON-LD globally here.
 */
export function JsonLd({ data }: { data: Array<Record<string, unknown>> }) {
  if (suppressStructuredDataForDeployment() || !data.length) return null;
  return (
    <script
      type="application/ld+json"
      // serializeLd escapes `<` so page data can't break out of the script tag.
      dangerouslySetInnerHTML={{ __html: serializeLd(data) }}
    />
  );
}
