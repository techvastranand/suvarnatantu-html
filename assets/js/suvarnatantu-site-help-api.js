// FAQ and store policies published from the admin panel (Engage "site help").
// Only published content is ever served by these public endpoints.
const API_ROOT = "https://api-engage.vastranand.com/v1/public/site-help/suvarnatantu";
const DEFAULT_TIMEOUT_MS = 8000;
const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SiteHelpApiError extends Error {
  constructor(kind, message = "Site help request failed") {
    super(message);
    this.name = "SiteHelpApiError";
    this.kind = kind;
  }
}

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value, max, required = false) => typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
const isId = value => Number.isInteger(value) && value > 0;
const isNullableDate = value => value === null || (typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)));

export function runtimeApiRoot(locationLike = globalThis.location, configuredRoot = globalThis.__SUVARNATANTU_SITE_HELP_API_ROOT__) {
  const hostname = locationLike?.hostname;
  if ((hostname === "localhost" || hostname === "127.0.0.1") && typeof configuredRoot === "string" && /^https?:\/\//.test(configuredRoot)) return configuredRoot.replace(/\/$/, "");
  return API_ROOT;
}

function parseEnvelope(payload) {
  if (!isObject(payload) || !isText(payload.message, 500) || !isObject(payload.data)) throw new SiteHelpApiError("malformed");
  return payload.data;
}

function validateQuestion(value) {
  if (!isObject(value) || !isId(value.id) || !isText(value.question, 300, true) || !isText(value.answer_html, 40000, true)) return null;
  return { id: value.id, question: value.question.trim(), answerHtml: value.answer_html, popular: value.popular === true };
}

export function parseFaqs(payload) {
  const data = parseEnvelope(payload);
  if (!Array.isArray(data.categories)) throw new SiteHelpApiError("malformed");
  const categories = [];
  for (const category of data.categories) {
    if (!isObject(category) || !isId(category.id) || !isText(category.name, 200, true) || !isText(category.description ?? "", 600) || !Array.isArray(category.questions)) continue;
    const questions = category.questions.map(validateQuestion).filter(Boolean);
    if (questions.length) categories.push({ id: category.id, name: category.name.trim(), description: (category.description || "").trim(), questions });
  }
  return categories;
}

function validatePolicySummary(value) {
  if (!isObject(value) || !isText(value.handle, 160, true) || !HANDLE_PATTERN.test(value.handle) || !isText(value.title, 200, true) || !isNullableDate(value.updated_at ?? null)) return null;
  return { handle: value.handle, title: value.title.trim(), updatedAt: value.updated_at || null };
}

export function parsePolicies(payload) {
  const data = parseEnvelope(payload);
  if (!Array.isArray(data.policies)) throw new SiteHelpApiError("malformed");
  return data.policies.map(validatePolicySummary).filter(Boolean);
}

export function parsePolicy(payload) {
  const data = parseEnvelope(payload);
  const summary = validatePolicySummary(data);
  if (!summary || !isText(data.body_html, 600000, true)) throw new SiteHelpApiError("malformed");
  return { ...summary, bodyHtml: data.body_html };
}

async function requestJson(url, { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof fetchImpl !== "function") throw new SiteHelpApiError("unavailable");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      mode: "cors",
      signal: controller.signal,
    });
    if (response.status === 404) throw new SiteHelpApiError("not-found");
    if (!response.ok) throw new SiteHelpApiError("unavailable");
    try {
      return await response.json();
    } catch {
      throw new SiteHelpApiError("malformed");
    }
  } catch (error) {
    if (error instanceof SiteHelpApiError) throw error;
    throw new SiteHelpApiError(controller.signal.aborted ? "timeout" : "unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

// One request per URL per page view: the header/footer links and the page body share it.
const inflight = new Map();
function shared(url, parse, options) {
  if (options?.fetchImpl) return requestJson(url, options).then(parse);
  if (!inflight.has(url)) {
    const request = requestJson(url, options).then(parse);
    request.catch(() => inflight.delete(url));
    inflight.set(url, request);
  }
  return inflight.get(url);
}

export function fetchFaqs({ apiRoot = runtimeApiRoot(), ...options } = {}) {
  return shared(`${apiRoot}/faqs`, parseFaqs, options);
}

export function fetchPolicies({ apiRoot = runtimeApiRoot(), ...options } = {}) {
  return shared(`${apiRoot}/policies`, parsePolicies, options);
}

export function fetchPolicy(handle, { apiRoot = runtimeApiRoot(), ...options } = {}) {
  if (!HANDLE_PATTERN.test(String(handle || ""))) return Promise.reject(new SiteHelpApiError("invalid-handle"));
  return shared(`${apiRoot}/policies/${encodeURIComponent(handle)}`, parsePolicy, options);
}

// The generic page (/policies/view/?handle=…) shows a policy without its own static page.
export function resolvePolicyHandle(locationLike) {
  const handle = new URL(locationLike.href, "https://suvarnatantu.com").searchParams.get("handle");
  return handle && HANDLE_PATTERN.test(handle) ? handle : null;
}

// Pages that already exist as approved static pages: the footer keeps its own links to them.
export const STATIC_POLICY_PAGES = { "privacy-policy": "/privacy-policy/", "terms-of-service": "/terms/" };

// Policies with their own static page at /policies/<handle>/ (one folder each in this repo).
export const POLICY_PAGES = new Set(["refund-policy", "shipping-policy", "contact-information", "legal-notice", "sample-policy", "payment-terms", "privacy-policy", "terms-of-service"]);

export function policyPath(handle) {
  return POLICY_PAGES.has(handle) ? `/policies/${handle}/` : `/policies/view/?handle=${encodeURIComponent(handle)}`;
}

export function questionAnchor(text, taken = new Set()) {
  const base = String(text).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "") || "question";
  let anchor = base;
  for (let number = 2; taken.has(anchor); number += 1) anchor = `${base}-${number}`;
  taken.add(anchor);
  return anchor;
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export { API_ROOT, HANDLE_PATTERN };
