export const INTENTS = {
  URL: "url",
  QUESTION: "question",
  CODE: "code",
  PRODUCT: "product",
  LOCATION: "location",
  MEDIA: "media",
  ACADEMIC: "academic",
  GENERAL: "general"
};

const URL_RE = /^(https?:\/\/|www\.)/i;
const QUESTION_RE = /\?|\b(what|why|how|when|where|who|compare|vs)\b/i;
const CODE_RE = /[{}()[\];]|\b(function|const|let|class|return|import|npm|pip)\b/;
const PRODUCT_RE = /\b(price|buy|review|best|cheap|deal|vs|compare|model)\b/i;
const LOCATION_RE = /\b(near me|address|map|directions|city|country|restaurant|hotel)\b/i;
const MEDIA_RE = /\b(video|watch|trailer|song|music|podcast)\b/i;
const ACADEMIC_RE = /\b(study|paper|journal|citation|doi|research)\b/i;

export function detectIntent(selection) {
  const text = (selection || "").trim();
  if (!text) {
    return INTENTS.GENERAL;
  }
  if (URL_RE.test(text)) {
    return INTENTS.URL;
  }
  if (ACADEMIC_RE.test(text)) {
    return INTENTS.ACADEMIC;
  }
  if (CODE_RE.test(text)) {
    return INTENTS.CODE;
  }
  if (LOCATION_RE.test(text)) {
    return INTENTS.LOCATION;
  }
  if (MEDIA_RE.test(text)) {
    return INTENTS.MEDIA;
  }
  if (PRODUCT_RE.test(text)) {
    return INTENTS.PRODUCT;
  }
  if (QUESTION_RE.test(text)) {
    return INTENTS.QUESTION;
  }
  return INTENTS.GENERAL;
}

export function intentEngineHints(intent) {
  switch (intent) {
    case INTENTS.URL:
      return ["perplexity", "google", "reddit"];
    case INTENTS.QUESTION:
      return ["perplexity", "chatgpt", "google", "wikipedia"];
    case INTENTS.CODE:
      return ["perplexity", "github", "stackoverflow", "google"];
    case INTENTS.PRODUCT:
      return ["perplexity", "amazon", "google", "reddit"];
    case INTENTS.LOCATION:
      return ["google", "bing", "perplexity"];
    case INTENTS.MEDIA:
      return ["youtube", "google", "perplexity"];
    case INTENTS.ACADEMIC:
      return ["scholar", "perplexity", "wikipedia", "google"];
    default:
      return ["perplexity", "google", "bing"];
  }
}
