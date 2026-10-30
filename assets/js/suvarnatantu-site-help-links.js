// Adds FAQ and live policy links to the shared header/footer, only once the API confirms
// there is published content behind them. Nothing is added while loading or on failure.
import { STATIC_POLICY_PAGES, fetchFaqs, fetchPolicies, policyPath, policyTitle } from "./suvarnatantu-site-help-api.js";

function link(href, label) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = label;
  anchor.dataset.siteHelpLink = "true";
  return anchor;
}

const footerColumn = () => document.querySelector(".site-footer .footer-grid > div:last-child");

function resourcesPanel() {
  const summary = [...document.querySelectorAll(".site-nav details.nav-dropdown > summary")].find(item => item.textContent.trim() === "Resources");
  return summary?.parentElement.querySelector(".dropdown-panel") || null;
}

function addOnce(container, href, label) {
  if (!container || container.querySelector(`a[href="${href}"]`)) return;
  container.append(link(href, label));
}

fetchFaqs().then(categories => {
  if (!categories.some(category => category.questions.length)) return;
  addOnce(resourcesPanel(), "/faq/", "FAQ");
  addOnce(footerColumn(), "/faq/", "FAQ");
}).catch(() => {});

fetchPolicies().then(policies => {
  const column = footerColumn();
  for (const policy of policies) {
    if (Object.hasOwn(STATIC_POLICY_PAGES, policy.handle)) continue;
    addOnce(column, policyPath(policy.handle), policyTitle(policy));
  }
}).catch(() => {});
