import { STATIC_POLICY_PAGES, fetchPolicies, fetchPolicy, formatDate, policyPath, policyTitle, resolvePolicyHandle } from "./suvarnatantu-site-help-api.js";
import { sanitizeArticleHtml } from "./suvarnatantu-blog-sanitize.js";

const SITE_ORIGIN = "https://suvarnatantu.com";
const root = document.querySelector("[data-policy-root]");

function setState(name) {
  root?.querySelectorAll("[data-policy-state]").forEach(section => {
    section.hidden = section.dataset.policyState !== name;
  });
  root?.setAttribute("aria-busy", name === "loading" ? "true" : "false");
}

function setRobots(value) {
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.append(robots);
  }
  robots.content = value;
}

function setMeta(selector, value, attribute = "content") {
  document.querySelector(selector)?.setAttribute(attribute, value);
}

// ── /policies/ : every live policy, plus the approved static Privacy and Terms pages ──
async function loadIndex() {
  const list = root.querySelector("[data-policy-list]");
  const note = root.querySelector("[data-policy-note]");
  const entries = [
    { href: STATIC_POLICY_PAGES["privacy-policy"], title: "Privacy Policy", updated: "" },
    { href: STATIC_POLICY_PAGES["terms-of-service"], title: "Terms & Conditions", updated: "" },
  ];
  try {
    for (const policy of await fetchPolicies()) {
      if (Object.hasOwn(STATIC_POLICY_PAGES, policy.handle)) continue;
      entries.push({ href: policyPath(policy.handle), title: policyTitle(policy), updated: formatDate(policy.updatedAt) });
    }
    note.hidden = entries.length > 2;
  } catch {
    note.hidden = false;
  }
  list.replaceChildren(...entries.map(entry => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = entry.href;
    link.append(entry.title);
    if (entry.updated) {
      const date = document.createElement("span");
      date.textContent = `Last updated ${entry.updated}`;
      link.append(date);
    }
    item.append(link);
    return item;
  }));
  setState("ready");
}

// ── /policies/<handle>/ ──────────────────────────────────────────────────────
async function loadDetail() {
  const handle = root.dataset.policyHandle || resolvePolicyHandle(location);
  const generic = !root.dataset.policyHandle;
  if (!handle) {
    setRobots("noindex,follow");
    setState("not-found");
    return;
  }
  setState("loading");
  try {
    const policy = await fetchPolicy(handle);
    const body = sanitizeArticleHtml(policy.bodyHtml);
    const updated = root.querySelector("[data-policy-updated]");
    const date = formatDate(policy.updatedAt);
    updated.textContent = date ? `Last updated ${date}` : "";
    updated.hidden = !date;
    root.querySelector("[data-policy-body]").innerHTML = body;
    // A known page keeps its full static name; the generic page takes the admin's title.
    // The generic page stays noindex, like the blog's runtime detail page.
    if (generic) {
      root.querySelector("[data-policy-title]").textContent = policy.title;
      root.querySelector("[data-policy-crumb]").textContent = policy.title;
      document.title = `${policy.title} | Suvarnatantu`;
      setMeta('meta[property="og:title"]', `${policy.title} | Suvarnatantu`);
      const canonical = `${SITE_ORIGIN}${policyPath(handle)}`;
      setMeta("link[data-policy-canonical]", canonical, "href");
      setMeta('meta[property="og:url"]', canonical);
    }
    setState("ready");
  } catch (error) {
    setRobots("noindex,follow");
    setState(error?.kind === "not-found" || error?.kind === "invalid-handle" ? "not-found" : "unavailable");
  }
}

if (root?.dataset.policyMode === "index") loadIndex();
else if (root) {
  root.querySelector("[data-policy-retry]")?.addEventListener("click", () => location.reload());
  loadDetail();
}
