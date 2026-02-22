export const BUILTIN_ENGINES = [
  {
    id: "perplexity",
    name: "Perplexity",
    category: "AI",
    urlTemplate: "https://www.perplexity.ai/search?q=%s",
    description: "AI answer engine with cited sources"
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "AI",
    urlTemplate: "https://chatgpt.com/?q=%s",
    description: "Conversational reasoning and synthesis"
  },
  {
    id: "google",
    name: "Google",
    category: "Web",
    urlTemplate: "https://www.google.com/search?q=%s",
    description: "General web search"
  },
  {
    id: "bing",
    name: "Bing",
    category: "Web",
    urlTemplate: "https://www.bing.com/search?q=%s",
    description: "General web search"
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    category: "Web",
    urlTemplate: "https://duckduckgo.com/?q=%s",
    description: "Private-first search"
  },
  {
    id: "github",
    name: "GitHub",
    category: "Developer",
    urlTemplate: "https://github.com/search?q=%s",
    description: "Code and repository search"
  },
  {
    id: "stackoverflow",
    name: "Stack Overflow",
    category: "Developer",
    urlTemplate: "https://stackoverflow.com/search?q=%s",
    description: "Developer Q&A"
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    category: "Research",
    urlTemplate: "https://en.wikipedia.org/wiki/Special:Search?search=%s",
    description: "Reference and knowledge"
  },
  {
    id: "scholar",
    name: "Google Scholar",
    category: "Research",
    urlTemplate: "https://scholar.google.com/scholar?q=%s",
    description: "Academic search"
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "Media",
    urlTemplate: "https://www.youtube.com/results?search_query=%s",
    description: "Video search"
  },
  {
    id: "reddit",
    name: "Reddit",
    category: "Social",
    urlTemplate: "https://www.reddit.com/search/?q=%s",
    description: "Community discussions"
  },
  {
    id: "amazon",
    name: "Amazon",
    category: "Shopping",
    urlTemplate: "https://www.amazon.com/s?k=%s",
    description: "Product discovery"
  }
];

export const ENGINE_IDS = BUILTIN_ENGINES.map((engine) => engine.id);

const ENGINE_MAP = new Map(BUILTIN_ENGINES.map((engine) => [engine.id, engine]));

export function getEngineById(engineId) {
  return ENGINE_MAP.get(engineId) || null;
}

export function getEnginesByIds(engineIds) {
  if (!Array.isArray(engineIds)) {
    return [];
  }
  return engineIds.map((id) => getEngineById(id)).filter((engine) => Boolean(engine));
}

export function buildEngineUrl(engineId, query) {
  const engine = getEngineById(engineId);
  if (!engine) {
    return null;
  }
  const encodedQuery = encodeURIComponent((query || "").trim());
  return engine.urlTemplate.replace("%s", encodedQuery);
}

export function groupEnginesByCategory() {
  const groups = new Map();
  BUILTIN_ENGINES.forEach((engine) => {
    if (!groups.has(engine.category)) {
      groups.set(engine.category, []);
    }
    groups.get(engine.category).push(engine);
  });
  return groups;
}
