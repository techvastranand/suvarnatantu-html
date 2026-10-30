import { fetchFaqs, questionAnchor } from "./suvarnatantu-site-help-api.js";
import { sanitizeArticleHtml } from "./suvarnatantu-blog-sanitize.js";

const root = document.querySelector("[data-faq-root]");
const list = root?.querySelector("[data-faq-list]");
const jump = root?.querySelector("[data-faq-jump]");
const search = root?.querySelector("[data-faq-search]");
const count = root?.querySelector("[data-faq-count]");
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let items = [];

function setState(name) {
  root?.querySelectorAll("[data-faq-state]").forEach(section => {
    section.hidden = section.dataset.faqState !== name;
  });
  root?.setAttribute("aria-busy", name === "loading" ? "true" : "false");
}

function noindex() {
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.append(robots);
  }
  robots.content = "noindex,follow";
}

const plainText = html => new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body.textContent.replace(/\s+/g, " ").trim();

function writeSchema(categories) {
  const schema = document.querySelector("[data-faq-schema]");
  if (!schema) return;
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: categories.flatMap(category => category.questions.map(question => ({
      "@type": "Question",
      name: question.question,
      acceptedAnswer: { "@type": "Answer", text: plainText(question.safeHtml) },
    }))),
  }).replace(/</g, "\\u003c");
}

function render(categories) {
  const anchors = new Set();
  const categoryAnchors = new Set();
  list.replaceChildren();
  jump.replaceChildren();
  items = [];
  for (const category of categories) {
    const section = document.createElement("section");
    section.className = "sh-category";
    section.id = `topic-${questionAnchor(category.name, categoryAnchors)}`;
    section.tabIndex = -1;
    const heading = document.createElement("h2");
    heading.textContent = category.name;
    section.append(heading);
    if (category.description) {
      const description = document.createElement("p");
      description.textContent = category.description;
      section.append(description);
    }
    const jumpItem = document.createElement("li");
    const jumpLink = document.createElement("a");
    jumpLink.href = `#${section.id}`;
    jumpLink.textContent = category.name;
    jumpItem.append(jumpLink);
    jump.append(jumpItem);

    for (const question of category.questions) {
      const details = document.createElement("details");
      details.className = "sh-item";
      details.id = questionAnchor(question.question, anchors);
      const summary = document.createElement("summary");
      summary.textContent = question.question;
      const answer = document.createElement("div");
      answer.className = "sh-answer";
      const prose = document.createElement("div");
      prose.className = "sh-prose";
      prose.innerHTML = question.safeHtml;
      const anchor = document.createElement("a");
      anchor.className = "sh-anchor";
      anchor.href = `#${details.id}`;
      anchor.textContent = "Link to this answer";
      answer.append(prose, anchor);
      details.append(summary, answer);
      section.append(details);
      items.push({ details, section, text: `${category.name} ${question.question} ${plainText(question.safeHtml)}`.toLowerCase() });
    }
    list.append(section);
  }
}

function applySearch() {
  const terms = (search.value || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const item of items) {
    const match = terms.every(term => item.text.includes(term));
    item.details.hidden = !match;
    if (match) shown += 1;
  }
  list.querySelectorAll(".sh-category").forEach(section => {
    section.hidden = ![...section.querySelectorAll(".sh-item")].some(details => !details.hidden);
  });
  jump.hidden = terms.length > 0;
  count.textContent = terms.length
    ? (shown ? `${shown} ${shown === 1 ? "question matches" : "questions match"} your search.` : "No questions match your search. Try other words or contact our team.")
    : `${items.length} ${items.length === 1 ? "question" : "questions"}.`;
}

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (!target || !list.contains(target)) return;
  if (target.hidden || target.closest("[hidden]")) {
    search.value = "";
    applySearch();
  }
  if (target.tagName === "DETAILS") target.open = true;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  (target.querySelector("summary") || target).focus({ preventScroll: true });
}

async function load() {
  if (!root) return;
  setState("loading");
  try {
    const categories = (await fetchFaqs()).map(category => ({
      ...category,
      questions: category.questions
        .map(question => ({ ...question, safeHtml: sanitizeArticleHtml(question.answerHtml) }))
        .filter(question => plainText(question.safeHtml)),
    })).filter(category => category.questions.length);
    if (!categories.length) throw new Error("empty");
    render(categories);
    writeSchema(categories);
    applySearch();
    setState("ready");
    openFromHash();
  } catch {
    noindex();
    setState("fallback");
  }
}

search?.addEventListener("input", applySearch);
search?.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    search.value = "";
    applySearch();
  }
});
window.addEventListener("hashchange", openFromHash);
load();
