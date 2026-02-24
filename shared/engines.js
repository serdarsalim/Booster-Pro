export const CATEGORY_ORDER = ["AI", "Web", "Tech", "Shopping", "News", "Research", "Social", "Productivity", "Utilities"];

export const BUILTIN_ENGINES = [
  { id: "perplexity", name: "Perplexity", category: "AI", urlTemplate: "https://www.perplexity.ai/search?q=%s" },
  { id: "youcom", name: "You.com", category: "AI", urlTemplate: "https://you.com/search?q=%s&fromSearchBar=true&tbm=youchat" },
  { id: "chatgpt", name: "ChatGPT", category: "AI", urlTemplate: "https://chatgpt.com/?q=%s" },
  { id: "google", name: "Google", category: "Web", urlTemplate: "https://www.google.com/search?q=%s" },
  { id: "bing", name: "Bing", category: "Web", urlTemplate: "https://www.bing.com/search?q=%s" },
  { id: "duckduckgo", name: "DuckDuckGo", category: "Web", urlTemplate: "https://duckduckgo.com/?q=%s" },
  { id: "github", name: "GitHub", category: "Tech", urlTemplate: "https://github.com/search?q=%s" },
  { id: "gitlab", name: "GitLab", category: "Tech", urlTemplate: "https://gitlab.com/search?search=%s" },
  { id: "stackoverflow", name: "Stack Overflow", category: "Tech", urlTemplate: "https://stackoverflow.com/search?q=%s" },
  { id: "mdn", name: "MDN", category: "Tech", urlTemplate: "https://developer.mozilla.org/en-US/search?q=%s" },
  { id: "npm", name: "NPM", category: "Tech", urlTemplate: "https://www.npmjs.com/search?q=%s" },
  { id: "pypi", name: "PyPI", category: "Tech", urlTemplate: "https://pypi.org/search/?q=%s" },
  { id: "hugging-face", name: "Hugging Face", category: "Tech", urlTemplate: "https://huggingface.co/search/full-text?q=%s" },
  { id: "docker-hub", name: "Docker Hub", category: "Tech", urlTemplate: "https://hub.docker.com/search?q=%s" },
  { id: "product-hunt", name: "Product Hunt", category: "Tech", urlTemplate: "https://www.producthunt.com/search?q=%s" },
  { id: "techcrunch", name: "TechCrunch", category: "Tech", urlTemplate: "https://techcrunch.com/search/%s/" },
  { id: "amazon", name: "Amazon", category: "Shopping", urlTemplate: "https://www.amazon.com/s?k=%s" },
  { id: "ebay", name: "eBay", category: "Shopping", urlTemplate: "https://www.ebay.com/sch/i.html?_nkw=%s" },
  { id: "alibaba", name: "Alibaba", category: "Shopping", urlTemplate: "https://www.alibaba.com/trade/search?SearchText=%s" },
  { id: "google-news", name: "Google News", category: "News", urlTemplate: "https://news.google.com/search?q=%s" },
  { id: "ai-monitor", name: "AI-Monitor", category: "News", urlTemplate: "https://aimonitor.ai/?s=%s" },
  { id: "ap-news", name: "AP News", category: "News", urlTemplate: "https://apnews.com/search?q=%s" },
  { id: "bbc", name: "BBC", category: "News", urlTemplate: "https://www.bbc.co.uk/search?q=%s" },
  { id: "cnn", name: "CNN", category: "News", urlTemplate: "https://www.cnn.com/search?q=%s&size=10" },
  { id: "reuters", name: "Reuters", category: "News", urlTemplate: "https://www.reuters.com/site-search/?query=%s" },
  { id: "the-guardian", name: "The Guardian", category: "News", urlTemplate: "https://www.theguardian.com/uk/search?q=%s" },
  { id: "al-jazeera", name: "Al Jazeera", category: "News", urlTemplate: "https://www.aljazeera.com/Search/?q=%s" },
  { id: "trt-world", name: "TRT World", category: "News", urlTemplate: "https://www.trtworld.com/search?q=%s" },
  { id: "scholar", name: "Google Scholar", category: "Research", urlTemplate: "https://scholar.google.com/scholar?q=%s" },
  { id: "semantic-scholar", name: "Semantic Scholar", category: "Research", urlTemplate: "https://www.semanticscholar.org/search?q=%s" },
  { id: "arxiv", name: "arXiv", category: "Research", urlTemplate: "https://arxiv.org/search/?query=%s&searchtype=all" },
  { id: "youtube", name: "YouTube", category: "Social", urlTemplate: "https://www.youtube.com/results?search_query=%s" },
  { id: "reddit", name: "Reddit", category: "Social", urlTemplate: "https://www.reddit.com/search/?q=%s" },
  { id: "facebook", name: "Facebook", category: "Social", urlTemplate: "https://www.facebook.com/search/top/?q=%s" },
  { id: "instagram", name: "Instagram", category: "Social", urlTemplate: "https://www.instagram.com/explore/search/keyword/?q=%s" },
  { id: "tiktok", name: "TikTok", category: "Social", urlTemplate: "https://www.tiktok.com/search?q=%s" },
  { id: "threads", name: "Threads", category: "Social", urlTemplate: "https://www.threads.net/search?q=%s" },
  { id: "pinterest", name: "Pinterest", category: "Social", urlTemplate: "https://www.pinterest.com/search/pins/?q=%s" },
  { id: "tumblr", name: "Tumblr", category: "Social", urlTemplate: "https://www.tumblr.com/search/%s" },
  { id: "linkedin", name: "LinkedIn", category: "Social", urlTemplate: "https://www.linkedin.com/search/results/all/?keywords=%s&origin=GLOBAL_SEARCH_HEADER" },
  { id: "quora", name: "Quora", category: "Social", urlTemplate: "https://www.quora.com/search?q=%s" },
  { id: "medium", name: "Medium", category: "Social", urlTemplate: "https://medium.com/search?q=%s" },
  { id: "hacker-news", name: "Hacker News", category: "Social", urlTemplate: "https://hn.algolia.com/?q=%s" },
  { id: "discord", name: "Discord", category: "Social", urlTemplate: "https://discord.com/search?q=%s" },
  { id: "substack", name: "Substack", category: "Social", urlTemplate: "https://substack.com/search/%s" },
  { id: "devto", name: "Dev.to", category: "Social", urlTemplate: "https://dev.to/search?q=%s" },
  { id: "imdb", name: "IMDb", category: "Social", urlTemplate: "https://www.imdb.com/find/?q=%s" },
  { id: "twitter", name: "Twitter/X", category: "Social", urlTemplate: "https://x.com/search?q=%s" },
  { id: "google-drive", name: "Google Drive", category: "Productivity", urlTemplate: "https://drive.google.com/drive/search?q=%s" },
  { id: "gmail", name: "Gmail", category: "Productivity", urlTemplate: "https://mail.google.com/mail/u/0/#search/%s" },
  { id: "notion", name: "Notion", category: "Productivity", urlTemplate: "https://www.notion.so/search?query=%s" },
  { id: "wikipedia", name: "Wikipedia", category: "Utilities", urlTemplate: "https://en.wikipedia.org/wiki/Special:Search?search=%s" },
  { id: "grokopedia", name: "Grokopedia", category: "Utilities", urlTemplate: "https://grokipedia.com/search?q=%s" },
  { id: "google-maps", name: "Google Maps", category: "Utilities", urlTemplate: "https://www.google.com/maps/search/%s" }
];

export const BUILTIN_ENGINE_IDS = BUILTIN_ENGINES.map((engine) => engine.id);

const BUILTIN_ENGINE_MAP = new Map(BUILTIN_ENGINES.map((engine) => [engine.id, engine]));

function sanitizeCategory(category) {
  if (!CATEGORY_ORDER.includes(category)) {
    return "Web";
  }
  return category;
}

export function sanitizeCustomEngine(rawEngine) {
  if (!rawEngine || typeof rawEngine !== "object") {
    return null;
  }

  const name = typeof rawEngine.name === "string" ? rawEngine.name.trim() : "";
  const id = typeof rawEngine.id === "string" ? rawEngine.id.trim() : "";
  const urlTemplate = typeof rawEngine.urlTemplate === "string" ? rawEngine.urlTemplate.trim() : "";
  const category = sanitizeCategory(rawEngine.category);

  if (!name || !id || !urlTemplate || !urlTemplate.includes("%s")) {
    return null;
  }

  return {
    id: id.startsWith("custom-") ? id : `custom-${id}`,
    name,
    category,
    urlTemplate,
    custom: true
  };
}

export function getBuiltinEngines(hiddenBuiltinIds = []) {
  const hidden = new Set(Array.isArray(hiddenBuiltinIds) ? hiddenBuiltinIds : []);
  return BUILTIN_ENGINES.filter((engine) => !hidden.has(engine.id));
}

export function getAvailableEngines(settings) {
  const hiddenBuiltinIds = settings && Array.isArray(settings.hiddenBuiltinIds) ? settings.hiddenBuiltinIds : [];
  const builtin = getBuiltinEngines(hiddenBuiltinIds);
  const custom = (settings && Array.isArray(settings.customEngines) ? settings.customEngines : [])
    .map((engine) => sanitizeCustomEngine(engine))
    .filter((engine) => Boolean(engine));
  const engineLabelOverrides = settings && settings.engineLabelOverrides && typeof settings.engineLabelOverrides === "object"
    ? settings.engineLabelOverrides
    : {};

  return [...builtin, ...custom].map((engine) => {
    const override = engineLabelOverrides[engine.id];
    if (typeof override !== "string") {
      return engine;
    }
    const trimmed = override.trim();
    if (!trimmed) {
      return engine;
    }
    return { ...engine, name: trimmed };
  });
}

export function getEngineMap(settings) {
  return new Map(getAvailableEngines(settings).map((engine) => [engine.id, engine]));
}

export function getEngineById(engineId, settings) {
  if (!settings) {
    return BUILTIN_ENGINE_MAP.get(engineId) || null;
  }
  return getEngineMap(settings).get(engineId) || null;
}

export function getEnginesByIds(engineIds, settings) {
  if (!Array.isArray(engineIds)) {
    return [];
  }
  return engineIds.map((id) => getEngineById(id, settings)).filter((engine) => Boolean(engine));
}

export function buildEngineUrl(engineId, query, settings) {
  const engine = getEngineById(engineId, settings);
  if (!engine) {
    return null;
  }
  const encodedQuery = encodeURIComponent((query || "").trim());
  return engine.urlTemplate.replace("%s", encodedQuery);
}

export function groupEnginesByCategory(settings) {
  const groups = new Map();
  CATEGORY_ORDER.forEach((category) => groups.set(category, []));

  getAvailableEngines(settings).forEach((engine) => {
    if (!groups.has(engine.category)) {
      groups.set(engine.category, []);
    }
    groups.get(engine.category).push(engine);
  });

  return groups;
}
