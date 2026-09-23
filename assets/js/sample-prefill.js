(() => {
  "use strict";

  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path !== "/samples") return;

  const allowed = {
    family: {
      "metallic-yarn": "Metallic Yarn",
      "zari-yarn": "Zari Yarn",
      "colours-finishes": "Colours & Finishes",
      "filament-yarn": "Filament Yarn",
      "twisted-yarn": "Twisted Yarn",
      "specialty-yarn": "Specialty Yarn",
    },
    product: {
      "m-type": "M Type",
      "mx-type": "MX Type",
      "st-type": "ST Type",
      "mh-type": "MH Type",
    },
    application: {
      saree: "Saree Weaving",
      jacquard: "Jacquard",
      brocade: "Brocade",
      embroidery: "Embroidery",
      knitting: "Knitting",
      lace: "Lace",
      "home-furnishing": "Home Furnishing",
      "decorative-textiles": "Decorative Textiles",
    },
    colour: {
      gold: "Gold",
      silver: "Silver",
      copper: "Copper",
      "rose-gold": "Rose Gold",
      antique: "Antique",
      "custom-colour": "Custom Colour",
    },
    finish: {
      bright: "Bright",
      "soft-metallic": "Soft Metallic",
      matte: "Matte",
      antique: "Antique",
      custom: "Custom",
    },
  };

  function readContext() {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(
      Object.entries(allowed)
        .map(([key, values]) => {
          const requested = params.get(key);
          return [key, Object.hasOwn(values, requested) ? values[requested] : ""];
        })
        .filter(([, value]) => value)
    );
  }

  function setControl(form, name, value) {
    const control = form.elements.namedItem(name);
    if (!control || !value) return false;
    if (control.tagName === "SELECT") {
      const supported = Array.from(control.options).some((option) => option.value === value);
      if (!supported) return false;
    }
    control.value = value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setFinish(form, finish) {
    const notes = form.elements.namedItem("notes");
    if (!notes || !finish) return false;
    const line = `Finish: ${finish}`;
    const existing = notes.value.trim();
    if (!existing.split("\n").includes(line)) {
      notes.value = existing ? `${line}\n${existing}` : line;
      notes.dispatchEvent(new Event("input", { bubbles: true }));
      notes.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }

  function addSummaryRow(list, label, value) {
    if (!value) return;
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    list.append(row);
  }

  function addBanner(form, context) {
    const banner = document.createElement("section");
    banner.className = "sample-context-banner";
    banner.setAttribute("aria-labelledby", "sample-context-title");

    const title = document.createElement("h2");
    title.id = "sample-context-title";
    title.textContent = "Sample request context";
    const copy = document.createElement("p");
    copy.textContent = "The Products page added the following context. Review or change the fields below before submitting.";
    const summary = document.createElement("dl");
    summary.className = "sample-context-summary";
    addSummaryRow(summary, "Product family", context.family);
    addSummaryRow(summary, "Product", context.product);
    addSummaryRow(summary, "Application", context.application);
    addSummaryRow(summary, "Colour", context.colour);
    addSummaryRow(summary, "Finish", context.finish);
    banner.append(title, copy, summary);
    form.before(banner);
  }

  function setup(form) {
    if (!form || form.dataset.sampleContextReady === "true") return;
    form.dataset.sampleContextReady = "true";

    // A valid Zari Lab handoff is richer and must remain the authoritative path.
    if (document.querySelector(".zari-handoff-banner")) return;

    const context = readContext();
    if (!Object.keys(context).length) return;

    const applied = {};
    if (setControl(form, "productType", context.family)) applied.family = context.family;
    if (setControl(form, "product", context.product)) applied.product = context.product;
    if (setControl(form, "application", context.application)) applied.application = context.application;
    if (setControl(form, "colour", context.colour)) applied.colour = context.colour;
    if (setFinish(form, context.finish)) applied.finish = context.finish;
    if (Object.keys(applied).length) addBanner(form, applied);
  }

  setup(document.querySelector("form[data-enquiry-form]"));
  document.addEventListener("suvarnatantu:b2b-form-ready", (event) => {
    if (event.detail?.kind === "sample") setup(event.detail.form);
  });
})();
