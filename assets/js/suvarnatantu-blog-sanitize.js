const ALLOWED_TAGS = new Set(["A", "BLOCKQUOTE", "BR", "CODE", "DEL", "EM", "FIGCAPTION", "FIGURE", "H2", "H3", "H4", "H5", "H6", "HR", "IMG", "LI", "OL", "P", "PRE", "S", "STRONG", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "U", "UL"]);
const DROP_WITH_CONTENT = new Set(["APPLET", "AUDIO", "BASE", "BUTTON", "CANVAS", "EMBED", "FORM", "IFRAME", "INPUT", "LINK", "MATH", "META", "NOSCRIPT", "OBJECT", "SCRIPT", "SELECT", "SOURCE", "STYLE", "SVG", "TEMPLATE", "TEXTAREA", "VIDEO"]);
const GLOBAL_ATTRIBUTES = new Set(["title"]);
const TAG_ATTRIBUTES = {
  A: new Set(["href", "target", "title"]),
  CODE: new Set(["class"]),
  H2: new Set(["id"]),
  H3: new Set(["id"]),
  H4: new Set(["id"]),
  H5: new Set(["id"]),
  H6: new Set(["id"]),
  IMG: new Set(["src", "alt", "width", "height", "title"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan", "scope"]),
};
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,99}$/;
const SAFE_LANGUAGE_CLASS = /^language-[a-z0-9_-]{1,40}$/i;
const SAFE_NUMBER = /^\d{1,4}$/;

export function safeContentUrl(value, { image = false } = {}) {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f\s]+/g, "").trim();
  if (!clean || clean.length > 2048) return null;
  if (!image && clean.startsWith("#")) return clean;
  try {
    const url = new URL(clean, "https://suvarnatantu.com/");
    const protocols = image ? new Set(["http:", "https:"]) : new Set(["http:", "https:", "mailto:", "tel:"]);
    if (!protocols.has(url.protocol)) return null;
    if (clean.startsWith("/") && !clean.startsWith("//")) return `${url.pathname}${url.search}${url.hash}`;
    return url.href;
  } catch {
    return null;
  }
}

function unwrap(element) {
  element.replaceWith(...element.childNodes);
}

function sanitizeAttributes(element) {
  const allowed = TAG_ATTRIBUTES[element.tagName] || GLOBAL_ATTRIBUTES;
  for (const attribute of [...element.attributes]) {
    if (!allowed.has(attribute.name.toLowerCase())) element.removeAttribute(attribute.name);
  }
  if (element.hasAttribute("id") && !SAFE_ID.test(element.getAttribute("id"))) element.removeAttribute("id");
  if (element.tagName === "CODE" && element.hasAttribute("class") && !SAFE_LANGUAGE_CLASS.test(element.getAttribute("class"))) element.removeAttribute("class");
  for (const name of ["width", "height", "colspan", "rowspan"]) {
    if (element.hasAttribute(name) && !SAFE_NUMBER.test(element.getAttribute(name))) element.removeAttribute(name);
  }
  if (element.tagName === "TH" && element.hasAttribute("scope") && !["col", "row", "colgroup", "rowgroup"].includes(element.getAttribute("scope"))) element.removeAttribute("scope");
}

function sanitizeLink(element) {
  const href = safeContentUrl(element.getAttribute("href") || "");
  if (href) element.setAttribute("href", href);
  else element.removeAttribute("href");
  const external = href && /^https?:/i.test(href) && new URL(href).origin !== "https://suvarnatantu.com";
  if (element.getAttribute("target") !== "_blank") element.removeAttribute("target");
  if (element.getAttribute("target") === "_blank" || external) element.setAttribute("rel", "noopener noreferrer");
  else element.removeAttribute("rel");
}

function sanitizeImage(element) {
  const src = safeContentUrl(element.getAttribute("src") || "", { image: true });
  if (!src) {
    element.remove();
    return;
  }
  element.setAttribute("src", src);
  element.setAttribute("loading", "lazy");
  element.setAttribute("decoding", "async");
  element.setAttribute("referrerpolicy", "no-referrer");
  if (!element.hasAttribute("alt")) element.setAttribute("alt", "");
}

export function sanitizeArticleHtml(html, parser = new DOMParser()) {
  const document = parser.parseFromString(`<!doctype html><html><body>${String(html || "")}</body></html>`, "text/html");
  const body = document.body;
  for (const element of [...body.querySelectorAll("*")]) {
    if (!element.isConnected) continue;
    if (DROP_WITH_CONTENT.has(element.tagName)) {
      element.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      unwrap(element);
      continue;
    }
    sanitizeAttributes(element);
    if (element.tagName === "A") sanitizeLink(element);
    if (element.tagName === "IMG") sanitizeImage(element);
  }
  return body.innerHTML;
}
