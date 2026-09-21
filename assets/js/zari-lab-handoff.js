(() => {
  "use strict";

  const STORAGE_KEY = "suvarnatantu_zari_lab_handoff";
  const SCHEMA_VERSION = 1;
  const MAX_AGE_MS = 4 * 60 * 60 * 1000;
  const REVIEW_VALUE_RE = /not sure|review required|technical review required|needs? review/i;
  const SCALAR_KEYS = [
    "application",
    "yarnType",
    "requirementStage",
    "quantity",
    "colour",
    "finish",
    "colourNote",
    "denier",
    "tpm",
    "twist",
    "construction",
    "referenceType",
    "physicalSample",
    "existingSpecification",
    "buyerNotes",
  ];

  const cleanString = (value, maximum = 1200) =>
    typeof value === "string" ? value.trim().slice(0, maximum) : "";

  const storage = {
    get() {
      try {
        return window.sessionStorage.getItem(STORAGE_KEY);
      } catch (_error) {
        return null;
      }
    },
    set(value) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        return true;
      } catch (_error) {
        return false;
      }
    },
    remove() {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch (_error) {
        // A blocked storage API must never block either enquiry form.
      }
    },
  };

  function sanitizeRequirement(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const requirement = {};
    SCALAR_KEYS.forEach((key) => {
      requirement[key] = cleanString(value[key]);
    });

    requirement.reviewRequired = Array.isArray(value.reviewRequired)
      ? value.reviewRequired.map((item) => cleanString(item, 180)).filter(Boolean).slice(0, 24)
      : [];

    const troubleshooting =
      value.troubleshooting && typeof value.troubleshooting === "object"
        ? value.troubleshooting
        : {};
    requirement.troubleshooting = {
      problemArea: cleanString(troubleshooting.problemArea, 300),
      observation: cleanString(troubleshooting.observation, 1200),
      desiredResult: cleanString(troubleshooting.desiredResult, 1200),
    };

    requirement.referenceFiles = Array.isArray(value.referenceFiles)
      ? value.referenceFiles
          .filter((file) => file && typeof file === "object")
          .slice(0, 5)
          .map((file) => ({
            name: cleanString(file.name, 240),
            type: cleanString(file.type, 120),
            size: Number.isFinite(Number(file.size)) && Number(file.size) >= 0
              ? Math.round(Number(file.size))
              : 0,
          }))
          .filter((file) => file.name)
      : [];

    const hasMeaningfulValue = SCALAR_KEYS.some((key) => requirement[key])
      || requirement.reviewRequired.length > 0
      || Object.values(requirement.troubleshooting).some(Boolean)
      || requirement.referenceFiles.length > 0;

    return hasMeaningfulValue ? requirement : null;
  }

  function destinationIntent() {
    const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
    if (path.endsWith("/samples")) return "sample";
    if (path.endsWith("/request-quote") || path.endsWith("/request-quote.html")) return "rfq";
    return "";
  }

  function readHandoff(intent) {
    const raw = storage.get();
    if (!raw) return null;

    let handoff;
    try {
      handoff = JSON.parse(raw);
    } catch (_error) {
      storage.remove();
      return null;
    }

    const preparedAt = Date.parse(handoff && handoff.preparedAt);
    const age = Date.now() - preparedAt;
    const structurallyValid = handoff
      && handoff.schemaVersion === SCHEMA_VERSION
      && handoff.source === "zari-lab"
      && (handoff.destinationIntent === "sample" || handoff.destinationIntent === "rfq")
      && Number.isFinite(preparedAt)
      && age >= -60000
      && age <= MAX_AGE_MS;

    if (!structurallyValid) {
      storage.remove();
      return null;
    }

    if (handoff.destinationIntent !== intent) return null;
    const requirement = sanitizeRequirement(handoff.requirement);
    if (!requirement) {
      storage.remove();
      return null;
    }

    return { ...handoff, requirement };
  }

  function queryNormalizedBrief() {
    let result = null;
    document.dispatchEvent(
      new CustomEvent("suvarnatantu:zari-brief-query", {
        detail: {
          respond(value) {
            result = value;
          },
        },
      })
    );
    return result;
  }

  function intentForLink(link) {
    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (_error) {
      return "";
    }
    if (url.origin !== window.location.origin) return "";
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    if (path.endsWith("/samples")) return "sample";
    if (path.endsWith("/request-quote") || path.endsWith("/request-quote.html")) return "rfq";
    return "";
  }

  function installSourceCapture() {
    if (!document.body.classList.contains("zari-lab-hub")) return;

    document.addEventListener(
      "click",
      (event) => {
        const link = event.target.closest("a[href]");
        if (!link) return;
        const intent = intentForLink(link);
        if (!intent) return;

        const brief = queryNormalizedBrief();
        const requirement = brief && brief.meaningful
          ? sanitizeRequirement(brief.requirement)
          : null;
        if (!requirement) {
          storage.remove();
          return;
        }

        storage.set({
          schemaVersion: SCHEMA_VERSION,
          source: "zari-lab",
          destinationIntent: intent,
          preparedAt: new Date().toISOString(),
          requirement,
        });
      },
      true
    );
  }

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatBytes(bytes) {
    if (!bytes) return "size unavailable";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isReviewValue(value) {
    return Boolean(value && REVIEW_VALUE_RE.test(value));
  }

  function addSummaryRow(list, label, value) {
    if (!value) return;
    const item = createElement("div", "zari-handoff-summary-row");
    item.append(createElement("dt", "", label), createElement("dd", "", value));
    list.append(item);
  }

  function buildSummary(requirement, compact = false) {
    const summary = createElement("dl", `zari-handoff-summary${compact ? " is-compact" : ""}`);
    addSummaryRow(summary, "Application", requirement.application);
    addSummaryRow(summary, "Yarn type", requirement.yarnType);
    addSummaryRow(
      summary,
      "Colour / finish",
      [requirement.colour, requirement.finish].filter(Boolean).join(" / ")
    );
    addSummaryRow(summary, "Denier", requirement.denier);
    addSummaryRow(summary, "TPM", requirement.tpm);
    addSummaryRow(summary, "Twist", requirement.twist);
    addSummaryRow(summary, "Construction", requirement.construction);
    addSummaryRow(summary, "Quantity", requirement.quantity);
    addSummaryRow(
      summary,
      "Review required",
      requirement.reviewRequired.length ? requirement.reviewRequired.join("; ") : "None flagged"
    );
    return summary;
  }

  function selectValue(control, candidates) {
    if (!control || control.tagName !== "SELECT") return "";
    const options = Array.from(control.options);
    for (const candidate of candidates.filter(Boolean)) {
      const match = options.find(
        (option) => option.value.toLowerCase() === candidate.toLowerCase()
          || option.textContent.trim().toLowerCase() === candidate.toLowerCase()
      );
      if (match) return match.value;
    }
    return "";
  }

  function parseQuantity(value) {
    if (!value || isReviewValue(value)) return null;
    const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|cones?|rolls?)?\s*$/i);
    if (!match) return null;
    const units = {
      kg: "KG",
      kgs: "KG",
      kilogram: "KG",
      kilograms: "KG",
      cone: "Cone",
      cones: "Cone",
      roll: "Roll",
      rolls: "Roll",
    };
    return { quantity: match[1], unit: match[2] ? units[match[2].toLowerCase()] : "" };
  }

  function buildPlan(form, requirement, intent) {
    const mappings = [];
    const mapped = new Set();
    const add = (name, value, label) => {
      const control = form.elements.namedItem(name);
      if (!control || !value) return;
      mappings.push({ control, name, value, label });
      mapped.add(label);
    };

    if (requirement.application && !isReviewValue(requirement.application)) {
      const control = form.elements.namedItem("application");
      const value = selectValue(control, [
        requirement.application,
        requirement.application.toLowerCase().includes("saree") ? "Saree Weaving" : "",
        requirement.application.toLowerCase().includes("brocade") ? "Brocade" : "",
        requirement.application.toLowerCase().includes("jacquard") ? "Jacquard" : "",
        requirement.application.toLowerCase().includes("embroidery") ? "Embroidery" : "",
        requirement.application.toLowerCase().includes("knit") ? "Knitting" : "",
        requirement.application.toLowerCase().includes("lace") ? "Lace" : "",
        requirement.application.toLowerCase().includes("furnish") ? "Home Furnishing" : "",
        requirement.application.toLowerCase().includes("decorative") ? "Decorative Textiles" : "",
        requirement.application.toLowerCase().includes("other") ? "Other" : "",
      ]);
      add("application", value, "Application");
    }

    if (requirement.yarnType && !isReviewValue(requirement.yarnType)) {
      add("product", requirement.yarnType, "Yarn type");
    }

    if (requirement.colour && !isReviewValue(requirement.colour)) {
      const colour = form.elements.namedItem("colour");
      const value = selectValue(colour, [
        requirement.colour,
        requirement.colour.toLowerCase().includes("custom") ? "Custom Colour" : "",
      ]);
      add("colour", value, "Colour");
    }

    if (requirement.denier && !isReviewValue(requirement.denier)) {
      add("denier", requirement.denier, "Denier");
    }
    if (requirement.tpm && !isReviewValue(requirement.tpm)) {
      add("tpm", requirement.tpm, "TPM");
    }
    if (requirement.twist) {
      const twist = form.elements.namedItem("twist");
      const value = selectValue(twist, [
        requirement.twist,
        isReviewValue(requirement.twist) ? "Not Sure / Need Recommendation" : "",
      ]);
      add("twist", value, "Twist");
    }

    const quantity = parseQuantity(requirement.quantity);
    if (quantity) {
      add("quantity", quantity.quantity, "Quantity");
      if (quantity.unit) add("unit", quantity.unit, "Quantity unit");
    }

    if (intent === "rfq" && requirement.requirementStage) {
      const stage = form.elements.namedItem("requirementType");
      const stageText = requirement.requirementStage.toLowerCase();
      const value = selectValue(stage, [
        requirement.requirementStage,
        stageText.includes("trial") ? "Trial" : "",
        stageText.includes("sample") || stageText.includes("development")
          ? "Development Requirement"
          : "",
        stageText.includes("bulk") ? "Bulk Purchase" : "",
        stageText.includes("regular") ? "Regular Purchase" : "",
        stageText.includes("export") ? "Export Requirement" : "",
      ]);
      add("requirementType", value, "Requirement stage");
    }

    const notes = buildTechnicalNotes(requirement, mapped);
    if (notes) add("notes", notes, "Technical notes");
    return mappings;
  }

  function buildTechnicalNotes(requirement, mapped) {
    const lines = ["Zari Lab Technical Requirement"];
    const add = (label, value) => {
      if (value) lines.push(`${label}: ${value}`);
    };

    if (!mapped.has("Application")) add("Application", requirement.application);
    if (!mapped.has("Yarn type")) add("Yarn type", requirement.yarnType);
    add("Requirement stage", mapped.has("Requirement stage") ? "" : requirement.requirementStage);
    if (!mapped.has("Quantity")) add("Quantity", requirement.quantity);
    if (!mapped.has("Colour")) add("Colour", requirement.colour);
    add("Finish", requirement.finish);
    add("Colour note", requirement.colourNote);
    if (!mapped.has("Denier")) add("Denier", requirement.denier);
    if (!mapped.has("TPM")) add("TPM", requirement.tpm);
    if (!mapped.has("Twist")) add("Twist", requirement.twist);
    add("Construction", requirement.construction);
    add("Reference type", requirement.referenceType);
    add("Physical sample", requirement.physicalSample);
    add("Existing specification", requirement.existingSpecification);

    if (requirement.reviewRequired.length) {
      add("Technical Review Required", requirement.reviewRequired.join("; "));
    }

    const troubleshooting = requirement.troubleshooting;
    if (Object.values(troubleshooting).some(Boolean)) lines.push("Technical Review Context");
    add("Problem area", troubleshooting.problemArea);
    add("Observed issue", troubleshooting.observation);
    add("Desired result", troubleshooting.desiredResult);
    add("Buyer notes", requirement.buyerNotes);

    requirement.referenceFiles.forEach((file, index) => {
      const type = file.type || "type unavailable";
      lines.push(`Reference file ${index + 1}: ${file.name} (${type}, ${formatBytes(file.size)})`);
    });
    if (requirement.referenceFiles.length) {
      lines.push("Reference file was selected in Zari Lab but is not attached to this enquiry.");
    }

    return lines.length > 1 ? lines.join("\n") : "";
  }

  function labelFor(control) {
    if (control.id) {
      const explicit = control.form.querySelector(`label[for="${CSS.escape(control.id)}"]`);
      if (explicit) return explicit;
    }
    return control.closest("label");
  }

  function markImported(control) {
    const label = labelFor(control);
    if (!label || label.querySelector(".zari-handoff-field-tag")) return;
    const tag = createElement("span", "zari-handoff-field-tag", "From Zari Lab");
    label.append(" ", tag);
    control.addEventListener(
      "input",
      () => tag.remove(),
      { once: true }
    );
  }

  function fieldHasValue(control) {
    if (!control) return false;
    if (control.type === "checkbox" || control.type === "radio") return control.checked;
    return cleanString(control.value, 10000) !== "";
  }

  function applyPlan(mappings, mode) {
    mappings.forEach(({ control, value }) => {
      if (mode === "empty" && fieldHasValue(control)) return;
      if (String(control.value) === String(value)) return;
      control.value = value;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      markImported(control);
    });
  }

  function installFocusTrap(dialog, initialFocus, onCancel) {
    const keydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll("button:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", keydown);
    window.requestAnimationFrame(() => initialFocus.focus());
    return () => dialog.removeEventListener("keydown", keydown);
  }

  function setupDestination(form, intent) {
    if (!form || form.dataset.zariHandoffReady === "true") return;
    form.dataset.zariHandoffReady = "true";

    const handoff = readHandoff(intent);
    if (!handoff) return;
    const { requirement } = handoff;
    const titleId = `zari-handoff-title-${intent}`;
    const reviewId = `zari-handoff-review-${intent}`;
    const conflictTitleId = `zari-handoff-conflict-title-${intent}`;

    const banner = createElement("section", "zari-handoff-banner");
    banner.setAttribute("aria-labelledby", titleId);
    const copy = createElement("div", "zari-handoff-copy");
    const title = createElement("h2", "", "Zari Lab requirement ready");
    title.id = titleId;
    copy.append(
      title,
      createElement(
        "p",
        "",
        `Use the technical requirement you prepared in Zari Lab for this ${intent === "sample" ? "sample request" : "RFQ"}.`
      )
    );

    const actions = createElement("div", "zari-handoff-actions");
    const useButton = createElement("button", "btn btn-primary", "Use Zari Lab Requirement");
    useButton.type = "button";
    const reviewButton = createElement("button", "btn btn-secondary", "Review First");
    reviewButton.type = "button";
    reviewButton.setAttribute("aria-expanded", "false");
    reviewButton.setAttribute("aria-controls", reviewId);
    const ignoreButton = createElement("button", "zari-handoff-ignore", "Ignore");
    ignoreButton.type = "button";
    actions.append(useButton, reviewButton, ignoreButton);
    banner.append(copy, actions);

    const review = createElement("section", "zari-handoff-review");
    review.id = reviewId;
    review.hidden = true;
    review.setAttribute("aria-labelledby", `${reviewId}-title`);
    const reviewTitle = createElement("h3", "", "Review Zari Lab requirement");
    reviewTitle.id = `${reviewId}-title`;
    reviewTitle.tabIndex = -1;
    const reviewActions = createElement("div", "zari-handoff-actions");
    const reviewUse = createElement("button", "btn btn-primary", "Use This Requirement");
    reviewUse.type = "button";
    const reviewCancel = createElement("button", "btn btn-secondary", "Cancel");
    reviewCancel.type = "button";
    reviewActions.append(reviewUse, reviewCancel);
    review.append(reviewTitle, buildSummary(requirement), reviewActions);
    banner.append(review);

    const overlay = createElement("div", "zari-handoff-dialog");
    overlay.hidden = true;
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", conflictTitleId);
    overlay.setAttribute("aria-describedby", `${conflictTitleId}-description`);
    const dialogCard = createElement("div", "zari-handoff-dialog-card");
    const conflictTitle = createElement("h3", "", "Some form fields already contain information");
    conflictTitle.id = conflictTitleId;
    const conflictDescription = createElement(
      "p",
      "",
      "Choose how to handle only the matching technical fields. Contact details, consent, and uploads will not be changed."
    );
    conflictDescription.id = `${conflictTitleId}-description`;
    const dialogActions = createElement("div", "zari-handoff-dialog-actions");
    const fillEmpty = createElement("button", "btn btn-primary", "Fill Empty Fields Only (Recommended)");
    fillEmpty.type = "button";
    const replace = createElement("button", "btn btn-secondary", "Replace Matching Fields");
    replace.type = "button";
    const cancel = createElement("button", "zari-handoff-ignore", "Cancel");
    cancel.type = "button";
    dialogActions.append(fillEmpty, replace, cancel);
    dialogCard.append(conflictTitle, conflictDescription, dialogActions);
    overlay.append(dialogCard);
    banner.append(overlay);

    form.before(banner);

    let returnFocus = useButton;
    let removeTrap = null;
    const closeDialog = () => {
      if (removeTrap) removeTrap();
      removeTrap = null;
      overlay.hidden = true;
      document.body.classList.remove("zari-handoff-dialog-open");
      returnFocus.focus();
    };

    const finishApply = (mode, plan) => {
      applyPlan(plan, mode);
      storage.remove();
      review.hidden = true;
      overlay.hidden = true;
      document.body.classList.remove("zari-handoff-dialog-open");
      banner.classList.add("is-applied");
      title.textContent = "Zari Lab requirement applied";
      copy.querySelector("p").textContent = "Imported technical fields remain editable before submission.";
      actions.replaceChildren();
      const status = createElement("p", "zari-handoff-status", "Requirement imported");
      status.setAttribute("role", "status");
      actions.append(status);
      const importedTitle = createElement("h3", "", "Imported requirement");
      importedTitle.id = `${reviewId}-title`;
      review.replaceChildren(importedTitle, buildSummary(requirement, true));
      review.hidden = false;
      form.querySelector("input:not([type='hidden']), select, textarea")?.focus();
    };

    const requestApply = (trigger) => {
      const plan = buildPlan(form, requirement, intent);
      const conflicts = plan.filter(({ control, value }) =>
        fieldHasValue(control) && String(control.value) !== String(value)
      );
      if (!conflicts.length) {
        finishApply("replace", plan);
        return;
      }
      returnFocus = trigger;
      overlay.hidden = false;
      document.body.classList.add("zari-handoff-dialog-open");
      removeTrap = installFocusTrap(overlay, fillEmpty, closeDialog);
    };

    useButton.addEventListener("click", () => requestApply(useButton));
    reviewUse.addEventListener("click", () => requestApply(reviewUse));
    reviewButton.addEventListener("click", () => {
      review.hidden = false;
      reviewButton.setAttribute("aria-expanded", "true");
      reviewTitle.focus();
    });
    reviewCancel.addEventListener("click", () => {
      review.hidden = true;
      reviewButton.setAttribute("aria-expanded", "false");
      reviewButton.focus();
    });
    ignoreButton.addEventListener("click", () => {
      storage.remove();
      banner.remove();
      form.querySelector("input:not([type='hidden']), select, textarea")?.focus();
    });
    fillEmpty.addEventListener("click", () => {
      const plan = buildPlan(form, requirement, intent);
      if (removeTrap) removeTrap();
      removeTrap = null;
      finishApply("empty", plan);
    });
    replace.addEventListener("click", () => {
      const plan = buildPlan(form, requirement, intent);
      if (removeTrap) removeTrap();
      removeTrap = null;
      finishApply("replace", plan);
    });
    cancel.addEventListener("click", closeDialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeDialog();
    });
  }

  function findDestinationForm(intent) {
    if (!intent) return;
    const form = document.querySelector("form[data-enquiry-form]");
    if (form) setupDestination(form, intent);
  }

  installSourceCapture();

  const intent = destinationIntent();
  if (intent) {
    document.addEventListener("suvarnatantu:b2b-form-ready", (event) => {
      const detail = event.detail || {};
      if (detail.kind === intent) setupDestination(detail.form, intent);
    });
    document.addEventListener("suvarnatantu:enquiry-submitted", storage.remove);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => findDestinationForm(intent), { once: true });
    } else {
      findDestinationForm(intent);
    }
    window.addEventListener("pageshow", () => findDestinationForm(intent));
  }
})();
