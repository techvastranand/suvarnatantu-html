(() => {
  "use strict";

  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path !== "/request-quote" && path !== "/request-quote.html") return;

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
    const context = Object.fromEntries(
      Object.entries(allowed)
        .map(([key, values]) => {
          const requested = params.get(key);
          return [key, Object.hasOwn(values, requested) ? values[requested] : ""];
        })
        .filter(([, value]) => value)
    );
    if (context.product) context.family = "Metallic Yarn";
    return context;
  }

  function setEmptyControl(form, name, value) {
    const control = form.elements.namedItem(name);
    if (!control || !value || String(control.value).trim()) return false;
    if (control.tagName === "SELECT") {
      const supported = Array.from(control.options).some((option) => option.value === value);
      if (!supported) return false;
    }
    control.value = value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setEmptyFinish(form, finish) {
    const notes = form.elements.namedItem("notes");
    if (!notes || !finish || notes.value.trim()) return false;
    notes.value = `Finish: ${finish}`;
    notes.dispatchEvent(new Event("input", { bubbles: true }));
    notes.dispatchEvent(new Event("change", { bubbles: true }));
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
    banner.className = "rfq-context-banner";
    banner.setAttribute("aria-labelledby", "rfq-context-title");

    const title = document.createElement("h2");
    title.id = "rfq-context-title";
    title.textContent = "Quotation request context";
    const copy = document.createElement("p");
    copy.textContent = "The Products page added the following context. Review or change the fields below before submitting.";
    const summary = document.createElement("dl");
    summary.className = "rfq-context-summary";
    addSummaryRow(summary, "Product family", context.family);
    addSummaryRow(summary, "Product", context.product);
    addSummaryRow(summary, "Application", context.application);
    addSummaryRow(summary, "Colour", context.colour);
    addSummaryRow(summary, "Finish", context.finish);
    banner.append(title, copy, summary);
    form.before(banner);
  }

  function setup(form) {
    if (!form || form.dataset.rfqContextReady === "true") return;
    form.dataset.rfqContextReady = "true";

    // Zari Lab is the richer source and is installed before this lightweight URL layer.
    if (document.querySelector(".zari-handoff-banner")) return;

    const context = readContext();
    if (!Object.keys(context).length) return;

    const applied = {};
    if (setEmptyControl(form, "productType", context.family)) applied.family = context.family;
    if (setEmptyControl(form, "product", context.product)) applied.product = context.product;
    if (setEmptyControl(form, "application", context.application)) applied.application = context.application;
    if (setEmptyControl(form, "colour", context.colour)) applied.colour = context.colour;
    if (setEmptyFinish(form, context.finish)) applied.finish = context.finish;
    if (Object.keys(applied).length) addBanner(form, applied);
  }

  setup(document.querySelector("form[data-enquiry-form]"));
  document.addEventListener("suvarnatantu:b2b-form-ready", (event) => {
    if (event.detail?.kind === "rfq") setup(event.detail.form);
  });
})();
