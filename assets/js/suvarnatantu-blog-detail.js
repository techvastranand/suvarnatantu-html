import { BlogApiError, fetchBlogDetail, readingTime, resolveBlogSlug } from "./suvarnatantu-blog-api.js";
import { sanitizeArticleHtml } from "./suvarnatantu-blog-sanitize.js";

const root = document.querySelector("[data-blog-detail]");
const FALLBACK_IMAGE = "/assets/images/blog/gold-metallic-yarn-texture.jpg";
const SITE_ORIGIN = "https://suvarnatantu.com";
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" });
let activeController;
let activeSlug;

function setState(name) {
  root?.querySelectorAll("[data-blog-state]").forEach(section => {
    section.hidden = section.dataset.blogState !== name;
  });
}

function setMeta(selector, value, attribute = "content") {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

function publicDetailUrl(slug) {
  const path = location.pathname;
  if (/^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(path)) return `${SITE_ORIGIN}${path.endsWith("/") ? path : `${path}/`}`;
  return `${SITE_ORIGIN}/blog/post/?slug=${encodeURIComponent(slug)}`;
}

function updateMetadata(post) {
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || "Technical yarn knowledge from Suvarnatantu.";
  const canonical = publicDetailUrl(post.slug);
  const image = post.ogMedia?.url || post.featuredMedia?.url || `${SITE_ORIGIN}${FALLBACK_IMAGE}`;
  document.title = `${title} | Suvarnatantu`;
  setMeta('meta[name="description"]', description);
  setMeta('meta[name="robots"]', "index,follow");
  setMeta('link[rel="canonical"]', canonical, "href");
  setMeta('meta[property="og:type"]', "article");
  setMeta('meta[property="og:title"]', post.ogTitle || title);
  setMeta('meta[property="og:description"]', post.ogDescription || description);
  setMeta('meta[property="og:url"]', canonical);
  setMeta('meta[property="og:image"]', image);
  setMeta('meta[name="twitter:card"]', "summary_large_image");
  setMeta('meta[name="twitter:title"]', post.ogTitle || title);
  setMeta('meta[name="twitter:description"]', post.ogDescription || description);
  setMeta('meta[name="twitter:image"]', image);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: canonical,
    author: { "@type": "Person", name: post.authorName },
    publisher: { "@type": "Organization", name: "Suvarnatantu", url: SITE_ORIGIN },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_ORIGIN}/blog/` },
      { "@type": "ListItem", position: 3, name: post.title, item: canonical },
    ],
  };
  document.querySelector("[data-blog-schema]").textContent = JSON.stringify(structuredData);
  document.querySelector("[data-blog-breadcrumb-schema]").textContent = JSON.stringify(breadcrumbs);
}

function renderPost(post) {
  root.querySelector("[data-detail-title]").textContent = post.title;
  root.querySelector("[data-detail-excerpt]").textContent = post.excerpt;
  root.querySelector("[data-detail-author]").textContent = post.authorName;
  root.querySelector("[data-detail-published]").textContent = dateFormatter.format(new Date(post.publishedAt));
  root.querySelector("[data-detail-published]").dateTime = post.publishedAt;
  root.querySelector("[data-detail-reading-time]").textContent = `${readingTime(post.bodyHtml)} min read`;

  const category = root.querySelector("[data-detail-category]");
  category.textContent = post.primaryCategory.name;
  category.href = `/blog/?category=${encodeURIComponent(post.primaryCategory.slug)}`;

  const updated = root.querySelector("[data-detail-updated]");
  const updatedWrapper = root.querySelector("[data-detail-updated-wrapper]");
  const hasUpdate = post.updatedAt !== post.publishedAt;
  updatedWrapper.hidden = !hasUpdate;
  if (hasUpdate) {
    updated.textContent = dateFormatter.format(new Date(post.updatedAt));
    updated.dateTime = post.updatedAt;
  }

  const image = root.querySelector("[data-detail-image]");
  image.src = post.featuredMedia?.url || FALLBACK_IMAGE;
  image.alt = post.featuredImageAlt || post.featuredMedia?.altText || "";
  image.width = post.featuredMedia?.width || 1200;
  image.height = post.featuredMedia?.height || 750;
  image.addEventListener("error", () => {
    if (!image.src.endsWith(FALLBACK_IMAGE)) image.src = FALLBACK_IMAGE;
  }, { once: true });

  const tags = root.querySelector("[data-detail-tags]");
  tags.replaceChildren();
  for (const tag of post.tags) {
    const item = document.createElement("span");
    item.textContent = tag.name;
    tags.append(item);
  }
  tags.hidden = post.tags.length === 0;

  root.querySelector("[data-detail-content]").innerHTML = sanitizeArticleHtml(post.bodyHtml);
  updateMetadata(post);
}

async function load() {
  const url = new URL(location.href);
  const querySlug = url.searchParams.get("slug");
  activeSlug = resolveBlogSlug(location);
  if (!activeSlug) {
    setState(querySlug === null ? "missing" : "invalid");
    return;
  }

  activeController?.abort();
  activeController = new AbortController();
  setState("loading");
  try {
    const post = await fetchBlogDetail(activeSlug, { signal: activeController.signal });
    renderPost(post);
    setState("ready");
  } catch (error) {
    if (error instanceof BlogApiError && error.kind === "aborted") return;
    setState(error instanceof BlogApiError && (error.kind === "not-found" || error.kind === "invalid-slug") ? "not-found" : "unavailable");
  }
}

root?.querySelectorAll("[data-blog-retry]").forEach(button => button.addEventListener("click", load));
window.addEventListener("pagehide", () => activeController?.abort(), { once: true });
if (root) load();
