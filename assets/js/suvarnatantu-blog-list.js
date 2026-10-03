import { BlogApiError, detailUrl, fetchBlogPage, readingTime } from "./suvarnatantu-blog-api.js";

const root = document.querySelector("[data-blog-list]");
const FALLBACK_IMAGE = "/assets/images/blog/gold-metallic-yarn-texture.jpg";
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" });
let activeController;
let currentPage = 1;

function setState(name) {
  root?.querySelectorAll("[data-blog-state]").forEach(section => { section.hidden = section.dataset.blogState !== name; });
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function postImage(post) {
  const image = document.createElement("img");
  image.src = post.featuredMedia?.url || FALLBACK_IMAGE;
  image.alt = post.featuredImageAlt || post.featuredMedia?.altText || "";
  image.width = post.featuredMedia?.width || 800;
  image.height = post.featuredMedia?.height || 500;
  image.loading = "lazy";
  image.decoding = "async";
  image.dataset.blogCardImage = "";
  image.addEventListener("error", () => {
    if (!image.src.endsWith(FALLBACK_IMAGE)) image.src = FALLBACK_IMAGE;
  }, { once: true });
  return image;
}

function renderCard(post) {
  const article = document.createElement("article");
  article.className = "kc-listing-card";
  const imageLink = document.createElement("a");
  imageLink.className = "kc-listing-card__image";
  imageLink.href = detailUrl(post.slug);
  imageLink.append(postImage(post));
  const body = document.createElement("div");
  body.className = "kc-listing-card__body";
  body.append(textElement("span", "kc-tag", post.primaryCategory.name));
  const heading = document.createElement("h2");
  const titleLink = document.createElement("a");
  titleLink.href = detailUrl(post.slug);
  titleLink.textContent = post.title;
  heading.append(titleLink);
  body.append(heading, textElement("p", "", post.excerpt));
  if (post.tags.length) {
    const tags = document.createElement("div");
    tags.className = "kc-card-tags";
    for (const tag of post.tags.slice(0, 4)) tags.append(textElement("span", "", tag.name));
    body.append(tags);
  }
  const footer = document.createElement("div");
  footer.className = "kc-listing-card__footer";
  const meta = textElement("div", "kc-meta", `${post.authorName} | ${dateFormatter.format(new Date(post.publishedAt))} | ${readingTime(post.bodyHtml)} min read`);
  const read = document.createElement("a");
  read.className = "kc-listing-card__read";
  read.href = detailUrl(post.slug);
  read.textContent = "Read article";
  read.setAttribute("aria-label", `Read ${post.title}`);
  footer.append(meta, read);
  body.append(footer);
  article.append(imageLink, body);
  return article;
}

function renderPagination(result) {
  const navigation = root.querySelector("[data-blog-pagination]");
  navigation.replaceChildren();
  const totalPages = Math.max(1, Math.ceil(result.recordsFiltered / result.limit));
  navigation.hidden = totalPages <= 1;
  if (totalPages <= 1) return;
  for (const [label, page, disabled] of [["Previous", result.page - 1, result.page <= 1], ["Next", result.page + 1, result.page >= totalPages]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button-outline";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", () => load(page));
    navigation.append(button);
  }
  navigation.insertBefore(textElement("span", "kc-page-count", `Page ${result.page} of ${totalPages}`), navigation.lastChild);
}

async function load(page = 1) {
  activeController?.abort();
  activeController = new AbortController();
  currentPage = page;
  setState("loading");
  const category = new URL(location.href).searchParams.get("category") || "";
  root.querySelectorAll(".kc-listing-nav a").forEach(link => {
    const linkCategory = new URL(link.href, location.origin).searchParams.get("category") || "";
    if (linkCategory === category) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  try {
    const result = await fetchBlogPage({ page, limit: 20, category, signal: activeController.signal });
    const grid = root.querySelector("[data-blog-grid]");
    grid.replaceChildren(...result.posts.map(renderCard));
    if (!result.posts.length) {
      setState(result.malformedCount > 0 ? "unavailable" : "empty");
      return;
    }
    root.querySelector("[data-blog-count]").textContent = `${result.recordsFiltered} ${result.recordsFiltered === 1 ? "article" : "articles"}`;
    renderPagination(result);
    setState("ready");
  } catch (error) {
    if (error instanceof BlogApiError && error.kind === "aborted") return;
    setState("unavailable");
  }
}

root?.querySelectorAll("[data-blog-retry]").forEach(button => button.addEventListener("click", () => load(currentPage)));
window.addEventListener("pagehide", () => activeController?.abort(), { once: true });
if (root) load();
