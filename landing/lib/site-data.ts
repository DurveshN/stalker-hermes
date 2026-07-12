export const CHANNELS = [
  { key: "linkedin", label: "LinkedIn", note: "posts · hiring · exec moves" },
  { key: "twitter", label: "X / Twitter", note: "launches · threads · sentiment" },
  { key: "news", label: "News", note: "press · funding · legal" },
  { key: "blog", label: "Blogs", note: "changelogs · eng posts" },
  { key: "seo", label: "SEO / Site", note: "pages · messaging · keywords" },
  { key: "product", label: "Product", note: "features · pricing · launches" },
] as const;

export type Severity = "critical" | "high" | "medium" | "low";

export interface FeedItem {
  competitor: string;
  channel: string;
  category: string;
  severity: Severity;
  title: string;
  ago: string;
}

// Illustrative feed used only for the animated hero demo.
export const DEMO_FEED: FeedItem[] = [
  { competitor: "Northwind AI", channel: "news", category: "funding", severity: "critical", title: "Raised $40M Series B led by Accel — repositioning up-market", ago: "2m" },
  { competitor: "Vertex Labs", channel: "product", category: "pricing", severity: "high", title: "Dropped the Starter tier to $0, gated exports behind Pro", ago: "9m" },
  { competitor: "Northwind AI", channel: "linkedin", category: "hiring", severity: "medium", title: "Opened 6 GTM roles in EMEA — expansion signal", ago: "14m" },
  { competitor: "Cobalt", channel: "seo", category: "marketing", severity: "high", title: "New /enterprise page targeting 'SOC2 automation'", ago: "22m" },
  { competitor: "Vertex Labs", channel: "twitter", category: "product", severity: "medium", title: "Teasing an agent SDK — waitlist thread gaining traction", ago: "31m" },
  { competitor: "Cobalt", channel: "blog", category: "product", severity: "low", title: "Changelog: shipped SSO + audit logs", ago: "48m" },
  { competitor: "Northwind AI", channel: "product", category: "partnership", severity: "high", title: "Announced Snowflake integration in private beta", ago: "1h" },
];

export const FEATURES = [
  {
    title: "A manager that plans, not a script that scrapes",
    body: "For every competitor the manager agent reads what changed, decides which specialists to run, and reviews their work — spawning deep-dive agents when something big breaks.",
  },
  {
    title: "Six specialists, one beat each",
    body: "LinkedIn, X, news, blogs, SEO and product each get a dedicated agent with live Linkup search. No single prompt trying to do everything.",
  },
  {
    title: "Only what matters reaches you",
    body: "Findings are deduped against history and scored for threat. You get an exception-based brief — text and voice — not a firehose.",
  },
  {
    title: "Every run is glass-box",
    body: "See the full trace tree, token and cost per step, diff two runs, and search across every run. Nothing happens you can't inspect.",
  },
];

export const FAQ = [
  {
    q: "How is this different from a Google Alert?",
    a: "Alerts match keywords. Stalker Hermes runs a crew of agents that read the source, judge whether it's a real competitive move, dedupe it against everything it's seen before, and score how much it threatens you — then briefs you in plain language.",
  },
  {
    q: "Where do the findings come from?",
    a: "Live web search via Linkup across LinkedIn, X, news, blogs and company sites. Every finding links back to its source — no invented URLs.",
  },
  {
    q: "How do I hear about a change?",
    a: "High-severity findings are pushed to Telegram as a text brief plus an ElevenLabs voice note. Everything else is in your dashboard, updating live.",
  },
  {
    q: "How often does it run?",
    a: "Every hour automatically, plus on-demand whenever you ask — from the dashboard or by messaging the bot.",
  },
];

export const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};
