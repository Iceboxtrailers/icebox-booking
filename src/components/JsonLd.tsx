// Structured data for search engines. The content is our own static data; "<" is escaped so nothing
// inside it could ever close the script tag.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
