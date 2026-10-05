const DEFAULT_API_ROOT = "https://api.vastranand.com/v1/suvarnatantu/blogs";
const DEFAULT_TIMEOUT_MS = 8000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export class BlogApiError extends Error {
  constructor(kind, message = "Blog request failed") {
    super(message);
    this.name = "BlogApiError";
    this.kind = kind;
  }
}

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isSafeString = (value, max, required = false) => typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
const isPositiveInteger = value => Number.isInteger(value) && value > 0;
const isNullablePositiveInteger = value => value === null || isPositiveInteger(value);
const isIsoDate = value => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));

export function safeHttpUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function runtimeApiRoot(locationLike = globalThis.location, configuredRoot = globalThis.__SUVARNATANTU_BLOG_API_ROOT__) {
  const hostname = locationLike?.hostname;
  if ((hostname === "localhost" || hostname === "127.0.0.1") && safeHttpUrl(configuredRoot)) return configuredRoot;
  return DEFAULT_API_ROOT;
}

function validateCategory(value) {
  if (!isObject(value) || !isSafeString(value.name, 100, true) || !isSafeString(value.slug, 100, true) || !SLUG_PATTERN.test(value.slug)) return null;
  return { name: value.name.trim(), slug: value.slug };
}

function validateTag(value) {
  return validateCategory(value);
}

function validateMedia(value) {
  if (value === null) return null;
  if (!isObject(value) || !isSafeString(value.alt_text, 300) || !IMAGE_TYPES.has(value.content_type)) return undefined;
  const url = safeHttpUrl(value.url);
  if (!url || !isNullablePositiveInteger(value.width) || !isNullablePositiveInteger(value.height)) return undefined;
  return {
    url,
    altText: value.alt_text.trim(),
    width: value.width,
    height: value.height,
    contentType: value.content_type,
  };
}

export function validatePost(value) {
  if (!isObject(value)) return { kind: "malformed" };
  if (Object.hasOwn(value, "status") && value.status !== "published") return { kind: "hidden" };
  if (!isSafeString(value.title, 200, true) || !isSafeString(value.slug, 200, true) || !SLUG_PATTERN.test(value.slug)) return { kind: "malformed" };
  if (!isSafeString(value.excerpt, 1000) || !isSafeString(value.body_html, 1000000) || !isSafeString(value.featured_image_alt, 300)) return { kind: "malformed" };
  if (!isSafeString(value.author_name, 160, true) || !isIsoDate(value.published_at) || !isIsoDate(value.updated_at)) return { kind: "malformed" };
  if (!isSafeString(value.seo_title, 200) || !isSafeString(value.seo_description, 320) || !isSafeString(value.og_title, 200) || !isSafeString(value.og_description, 320)) return { kind: "malformed" };
  const category = validateCategory(value.primary_category);
  const featuredMedia = validateMedia(value.featured_media);
  const ogMedia = validateMedia(value.og_media);
  if (!category || featuredMedia === undefined || ogMedia === undefined || !Array.isArray(value.tags)) return { kind: "malformed" };
  const tags = value.tags.map(validateTag);
  if (tags.some(tag => tag === null)) return { kind: "malformed" };
  const canonicalUrl = value.canonical_url === "" ? "" : safeHttpUrl(value.canonical_url);
  if (canonicalUrl === null) return { kind: "malformed" };
  return {
    kind: "published",
    post: {
      status: "published",
      title: value.title.trim(),
      slug: value.slug,
      excerpt: value.excerpt.trim(),
      bodyHtml: value.body_html,
      featuredMedia,
      featuredImageAlt: value.featured_image_alt.trim(),
      authorName: value.author_name.trim(),
      primaryCategory: category,
      tags,
      publishedAt: value.published_at,
      seoTitle: value.seo_title.trim() || value.title.trim(),
      seoDescription: value.seo_description.trim() || value.excerpt.trim(),
      canonicalUrl: canonicalUrl || "",
      ogTitle: value.og_title.trim() || value.seo_title.trim() || value.title.trim(),
      ogDescription: value.og_description.trim() || value.seo_description.trim() || value.excerpt.trim(),
      ogMedia,
      updatedAt: value.updated_at,
    },
  };
}

function parseEnvelope(payload) {
  if (!isObject(payload) || !isSafeString(payload.message, 500) || !Object.hasOwn(payload, "data")) throw new BlogApiError("malformed");
  return payload.data;
}

export function parseBlogPage(payload) {
  const data = parseEnvelope(payload);
  if (!isObject(data) || !isPositiveInteger(data.page) || !isPositiveInteger(data.limit) || !Number.isInteger(data.records_total) || data.records_total < 0 || !Number.isInteger(data.records_filtered) || data.records_filtered < 0 || !Array.isArray(data.data) || !isSafeString(data.content_version, 200, true)) throw new BlogApiError("malformed");
  const posts = [];
  let hiddenCount = 0;
  let malformedCount = 0;
  for (const candidate of data.data) {
    const result = validatePost(candidate);
    if (result.kind === "published") posts.push(result.post);
    else if (result.kind === "hidden") hiddenCount += 1;
    else malformedCount += 1;
  }
  return {
    page: data.page,
    limit: data.limit,
    recordsTotal: data.records_total,
    recordsFiltered: data.records_filtered,
    contentVersion: data.content_version,
    posts,
    hiddenCount,
    malformedCount,
  };
}

export function parseBlogDetail(payload) {
  const result = validatePost(parseEnvelope(payload));
  if (result.kind !== "published") throw new BlogApiError(result.kind === "hidden" ? "not-found" : "malformed");
  return result.post;
}

async function requestJson(url, { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  if (typeof fetchImpl !== "function") throw new BlogApiError("unavailable");
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      mode: "cors",
      signal: controller.signal,
    });
    if (response.status === 404) throw new BlogApiError("not-found");
    if (!response.ok) throw new BlogApiError("unavailable");
    try {
      return await response.json();
    } catch {
      throw new BlogApiError("malformed");
    }
  } catch (error) {
    if (error instanceof BlogApiError) throw error;
    if (controller.signal.aborted && signal?.aborted) throw new BlogApiError("aborted");
    throw new BlogApiError("unavailable");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function fetchBlogPage({ page = 1, limit = 20, category = "", tag = "", apiRoot = runtimeApiRoot(), ...options } = {}) {
  const url = new URL(apiRoot);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  if (SLUG_PATTERN.test(category)) url.searchParams.set("category", category);
  if (SLUG_PATTERN.test(tag)) url.searchParams.set("tag", tag);
  return parseBlogPage(await requestJson(url.href, options));
}

export async function fetchBlogDetail(slug, { apiRoot = runtimeApiRoot(), ...options } = {}) {
  if (!SLUG_PATTERN.test(String(slug || ""))) throw new BlogApiError("invalid-slug");
  return parseBlogDetail(await requestJson(`${apiRoot}/${encodeURIComponent(slug)}`, options));
}

export function detailUrl(slug) {
  return `/blog/post/?slug=${encodeURIComponent(slug)}`;
}

export function resolveBlogSlug(locationLike) {
  const url = new URL(locationLike.href, "https://suvarnatantu.com");
  const querySlug = url.searchParams.get("slug");
  if (querySlug !== null) return SLUG_PATTERN.test(querySlug) ? querySlug : null;
  const match = /^\/blog\/([^/]+)\/?$/.exec(url.pathname);
  if (!match || ["post", "articles", "category"].includes(match[1])) return null;
  return SLUG_PATTERN.test(match[1]) ? match[1] : null;
}

export function readingTime(html) {
  const text = String(html || "").replace(/<[^>]*>/g, " ").replace(/&[a-z0-9#]+;/gi, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

export { DEFAULT_API_ROOT, SLUG_PATTERN };
