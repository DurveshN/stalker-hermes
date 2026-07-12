// Named, version-controlled eval set. Seed cases + regression cases (the
// closed loop appends regression cases to Convex when a human flags a finding
// as "wrong"; run-evals.ts pulls those in too).
export interface EvalCase {
  name: string;
  competitorName: string;
  focus?: string;
  minFindings: number;
  requireSourceUrls: boolean;
  expectCategories: string[]; // at least one finding should match one of these
}

export const SEED_CASES: EvalCase[] = [
  {
    name: "seed:openai-general",
    competitorName: "OpenAI",
    minFindings: 2,
    requireSourceUrls: true,
    expectCategories: ["product", "funding", "partnership", "marketing", "other"],
  },
  {
    name: "seed:anthropic-product",
    competitorName: "Anthropic",
    focus: "recent product and model launches",
    minFindings: 1,
    requireSourceUrls: true,
    expectCategories: ["product"],
  },
  {
    name: "seed:perplexity-funding",
    competitorName: "Perplexity AI",
    focus: "funding and valuation",
    minFindings: 1,
    requireSourceUrls: true,
    expectCategories: ["funding", "other"],
  },
  {
    name: "seed:vercel-seo",
    competitorName: "Vercel",
    focus: "website messaging and positioning changes",
    minFindings: 1,
    requireSourceUrls: true,
    expectCategories: ["marketing", "product", "other"],
  },
];
