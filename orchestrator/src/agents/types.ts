import { z } from "zod";

export type Channel = "linkedin" | "twitter" | "news" | "blog" | "seo" | "product";

export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

// What a specialist returns for each item it finds.
export const FindingSchema = z.object({
  title: z.string().describe("Short headline of the development"),
  url: z.string().describe("Source URL (must be a real link from the search results)"),
  summary: z.string().describe("2-3 sentence factual summary of what happened"),
  category: z
    .enum(["funding", "product", "hiring", "marketing", "pricing", "partnership", "other"])
    .describe("Best-fit category"),
  severity: z
    .enum(SEVERITIES)
    .describe("Competitive threat level to our business"),
  relevance: z.number().min(0).max(1).describe("0-1 how relevant/important this is"),
  publishedAt: z.string().optional().describe("ISO date if known"),
});
export type Finding = z.infer<typeof FindingSchema>;

export const SpecialistOutputSchema = z.object({
  findings: z.array(FindingSchema),
  notes: z.string().describe("Brief note on coverage, gaps, or anomalies"),
});
export type SpecialistOutput = z.infer<typeof SpecialistOutputSchema>;

export const CHANNEL_BRIEF: Record<Channel, { role: string; guidance: string }> = {
  linkedin: {
    role: "LinkedIn tracker",
    guidance:
      "Company page posts, headcount/hiring signals, exec announcements, funding, culture posts.",
  },
  twitter: {
    role: "X/Twitter tracker",
    guidance:
      "Recent tweets from the company and execs, launches, threads, sentiment, viral moments.",
  },
  news: {
    role: "News tracker",
    guidance: "Press coverage, funding rounds, partnerships, exec moves, legal/regulatory.",
  },
  blog: {
    role: "Blog/content tracker",
    guidance: "Company blog posts, changelogs, engineering posts, thought-leadership content.",
  },
  seo: {
    role: "SEO/website tracker",
    guidance:
      "New landing pages, positioning/messaging changes, target keywords, pricing-page changes.",
  },
  product: {
    role: "Product/pricing tracker",
    guidance: "New features, product launches, pricing/tier changes, integrations, deprecations.",
  },
};
