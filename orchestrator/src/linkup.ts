import { LinkupClient } from "linkup-sdk";
import { config } from "./config.js";

const client = new LinkupClient({ apiKey: config.linkupApiKey });

export type Depth = "fast" | "standard" | "deep";

export interface NormalizedResult {
  name: string;
  url: string;
  content: string;
}

// Raw search → normalized {name,url,content}[]. Handles both `{results:[...]}`
// and bare-array response shapes across SDK versions.
export async function linkupSearchResults(
  query: string,
  depth: Depth = "standard",
  opts: { maxResults?: number; fromDate?: Date; includeDomains?: string[] } = {},
): Promise<{ results: NormalizedResult[]; raw: unknown }> {
  const raw: any = await client.search({
    query,
    depth,
    outputType: "searchResults",
    ...(opts.maxResults ? { maxResults: opts.maxResults } : {}),
    ...(opts.fromDate ? { fromDate: opts.fromDate } : {}),
    ...(opts.includeDomains ? { includeDomains: opts.includeDomains } : {}),
  } as any);

  const list: any[] = Array.isArray(raw) ? raw : raw?.results ?? [];
  const results: NormalizedResult[] = list
    .filter((r) => r && (r.url || r.name))
    .map((r) => ({
      name: String(r.name ?? r.title ?? ""),
      url: String(r.url ?? ""),
      content: String(r.content ?? r.snippet ?? ""),
    }));
  return { results, raw };
}

// Structured extraction against a JSON schema (for SEO/pricing structured pulls).
export async function linkupStructured<T = unknown>(
  query: string,
  schema: object,
  depth: Depth = "deep",
): Promise<{ data: T; raw: unknown }> {
  const raw: any = await client.search({
    query,
    depth,
    outputType: "structured",
    structuredOutputSchema: schema,
  } as any);
  return { data: raw as T, raw };
}
