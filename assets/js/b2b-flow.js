(() => {
  const products = window.SuvarnatantuProducts || {};
  const path = location.pathname.replace(/\/$/, '');
  const intakeFields = (source, enquiryType) => `<input type='hidden' name='source_url' value='${source}'><input type='hidden' name='enquiry_type' value='${enquiryType}'><input type='hidden' name='brand' value='Suvarnatantu'><input type='hidden' name='website' value='https://suvarnatantu.com/'><input class='honeypot' type='text' name='honeypot' tabindex='-1' autocomplete='off' aria-hidden='true'>`;
  const INTAKE_API = 'https://vastranand.com/v1/public/suvarnatantu-enquiries';
  const INTAKE_TIMEOUT_MS = 10000;
  const THANK_YOU_PATH = '/enquiry-thank-you/';
  const FAILURE_MESSAGE = 'We couldn\u2019t submit your enquiry. Please try again or contact us on WhatsApp.';
  const newSubmissionUuid = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  };
  const ensureSubmissionUuid = form => {
    if (!form.dataset.submissionUuid) form.dataset.submissionUuid = newSubmissionUuid();
    let field = form.elements.submission_uuid;
    if (!field) { field = document.createElement('input'); field.type = 'hidden'; field.name = 'submission_uuid'; form.append(field); }
    field.value = form.dataset.submissionUuid;
    return field.value;
  };
  const normalizedEnquiry = form => {
    ensureSubmissionUuid(form);
    const fields = Object.fromEntries(Array.from(new FormData(form).entries(), ([key, value]) => [key, String(value)]));
    const declaredType = fields.enquiry_type || '';
    const enquiryType = declaredType.includes('Homepage') ? 'business' : (declaredType.includes('Quote') ? 'quote' : 'sample');
    return {
      submission_uuid: ensureSubmissionUuid(form), enquiry_type: enquiryType,
      name: fields.full_name || fields.contact || '', company: fields.company || null,
      email: fields.email || '', phone: fields.phone || null,
      message: fields.requirement || fields.additionalNotes || fields.notes || null,
      product: fields.product || null, category: fields.productType || null,
      payload: fields, source_page: fields.source_url || location.href,
      honeypot: fields.honeypot || ''
    };
  };
  const postIntake = async payload => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), INTAKE_TIMEOUT_MS);
    try {
      const response = await fetch(INTAKE_API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) { const body = await response.json().catch(() => ({})); const error = new Error(body.detail || 'The enquiry service could not accept this request.'); error.definite = true; throw error; }
      return await response.json();
    } finally { clearTimeout(timeout); }
  };
  const submitIntake = async payload => {
    try { return await postIntake(payload); }
    catch (error) { if (error?.name !== 'AbortError') throw error; return postIntake(payload); }
  };
  const setupDeliveryForm = (form) => {
    if (!form || form.dataset.deliveryReady === 'true') return;
    form.dataset.deliveryReady = 'true';
    const button = form.querySelector('[type=submit]');
    const status = form.querySelector('.form-errors');
    const originalLabel = button?.dataset.submitLabel || button?.textContent || '';
    const reset = () => {
      form.dataset.apiSubmitting = 'false';
      if (button) { button.disabled = false; button.textContent = originalLabel; }
      if (status) status.textContent = '';
    };
    reset();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (form.dataset.apiSubmitting === 'true') return;
      if (form.elements.honeypot?.value) {
        if (status) status.textContent = FAILURE_MESSAGE;
        return;
      }
      form.dataset.apiSubmitting = 'true';
      const submissionUuid = ensureSubmissionUuid(form);
      if (button) { button.disabled = true; button.textContent = 'Sending enquiry\u2026'; }
      if (status) status.textContent = 'Saving your enquiry\u2026';
      try {
        const payload = normalizedEnquiry(form); payload.submission_uuid = submissionUuid;
        await submitIntake(payload);
        if (status) status.textContent = 'Enquiry submitted. Redirecting\u2026';
        window.location.assign(THANK_YOU_PATH);
      } catch (error) {
        form.dataset.apiSubmitting = 'false';
        if (button) { button.disabled = false; button.textContent = originalLabel; }
        if (status) status.textContent = FAILURE_MESSAGE;
      }
    });
    window.addEventListener('pageshow', reset);
  };
  const product = Object.entries(products).find(([id]) => path.endsWith(`/${id}`));
  const options = (items, empty) => `<option value="">${empty}</option>${items.map(x => `<option>${x}</option>`).join('')}`;
  const fields = (prefix = '') => `<div class="b2b-fields">
    <label>Colour<select name="${prefix}colour">${options(['Gold','Silver','Copper','Rose Gold','Antique','Custom Colour'], 'Select colour')}</select></label>
    <label>Denier<select name="${prefix}denier">${options(['Custom / Specify Requirement','Need Recommendation'], 'Select denier')}</select></label>
    <label>Twist direction<select name="${prefix}twist">${options(['S Twist','Z Twist','Not Sure / Need Recommendation'], 'Select twist')}</select></label>
    <label>TPM<select name="${prefix}tpm">${options(['Custom TPM','Need Recommendation'], 'Select TPM')}</select></label>
    <label>Application<select name="${prefix}application">${options(['Saree Weaving','Jacquard','Brocade','Embroidery','Knitting','Lace','Home Furnishing','Decorative Textiles','Other'], 'Select application')}</select></label>
    <label>Required quantity<input name="${prefix}quantity" inputmode="decimal" type="number" min="0" step="any" placeholder="Quantity"></label>
    <label>Unit<select name="${prefix}unit">${options(['KG','Cone','Roll','Other'], 'Select unit')}</select></label>
    <label>Packing preference<select name="${prefix}packing">${options(['Cone','Spool','Standard Industrial Packing','Custom Packing','Need Recommendation'], 'Select packing')}</select></label>
    <label class="full">Additional requirements<textarea name="${prefix}notes" placeholder="Tell us about shade, yarn construction, machine/application, target specification or any special requirement."></textarea></label>
  </div>`;
  const encodeConfig = (form) => Object.fromEntries(new FormData(form).entries());
  const saveAndGo = (form, route) => { sessionStorage.setItem('suvarnatantuB2BConfig', JSON.stringify(encodeConfig(form))); location.href = route; };
  const whatsapp = (data, intent) => {
    const labels = { productType: 'Category' };
    const lines = [`Hello Suvarnatantu,`, ``, `I would like to request a ${intent}.`, ``, ...Object.entries(data).filter(([k,v]) => v && !k.startsWith('_') && !['source_url','enquiry_type','brand','website','consent'].includes(k)).map(([k,v]) => `${labels[k] || k.replace(/\b\w/g,c=>c.toUpperCase())}: ${v}`), ``, `Please review my requirement.`];
    return `https://wa.me/918154000962?text=${encodeURIComponent(lines.join('\n'))}`;
  };
  if (product) {
    const [id, info] = product;
    const section = document.createElement('section'); section.className = 'b2b-config-section';
    section.innerHTML = `<div class="wrap"><div class="b2b-config"><header class="b2b-config__header"><div><div class="eyebrow">B2B requirement builder</div><h2>Configure your requirement</h2><p>Build a sourcing brief for quotation or sample evaluation. Select the specifications you know — our team can assist with the rest.</p></div><div class="b2b-product-context"><span>Current product</span><strong>${info.name}</strong><em>${info.type}</em></div></header><ol class="b2b-progress"><li><b>01</b><span>Product</span></li><li><b>02</b><span>Specification</span></li><li><b>03</b><span>Quantity</span></li><li><b>04</b><span>Requirement</span></li></ol><form class="b2b-config__form" data-configurator><input type="hidden" name="product" value="${info.name}"><input type="hidden" name="productType" value="${info.type}">${fields()}<p class="b2b-help"><strong>Need technical guidance?</strong> Not sure about Denier, TPM or Twist? Select “Need Recommendation” and our team can review the application.</p><div class="commercial-grid"><span><b>Price</b><strong>${window.SuvarnatantuCommercialDefaults.price}</strong><small>${window.SuvarnatantuCommercialDefaults.priceNote}</small></span><span><b>MOQ</b><strong>${window.SuvarnatantuCommercialDefaults.moq}</strong></span><span><b>Samples</b><strong>${window.SuvarnatantuCommercialDefaults.sample}</strong></span><span><b>Lead time</b><strong>${window.SuvarnatantuCommercialDefaults.leadTime}</strong></span></div><div class="b2b-actions"><button class="button" type="button" data-go="/request-quote/">Request a Quote</button><button class="button-outline" type="button" data-go="/samples/">Request a Sample</button><a class="text-link" data-whatsapp target="_blank" rel="noopener">Continue on WhatsApp</a></div></form></div></div></section>`;
    document.querySelector('main').insertBefore(section, document.querySelector('main').children[1] || null);
    section.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => saveAndGo(section.querySelector('form'), button.dataset.go)));
    const form = section.querySelector('form'); const wa = section.querySelector('[data-whatsapp]'); const refresh = () => wa.href = whatsapp(encodeConfig(form), 'quote'); form.addEventListener('input', refresh); form.addEventListener('change', refresh); refresh();
    document.body.classList.add('has-b2b-product');
  }
  const stored = JSON.parse(sessionStorage.getItem('suvarnatantuB2BConfig') || '{}');
  const isQuote = path === '/request-quote'; const isSample = path === '/samples';
  if (isQuote || isSample) {
    const kind = isQuote ? 'quote' : 'sample'; const host = document.querySelector('.form-page'); if (!host) return;
    const title = isQuote ? 'Request a Quote' : 'Request a Production Sample'; const intro = isQuote ? 'Share your specification, quantity and commercial requirement for a B2B quotation.' : 'Evaluate colour, construction and application suitability before proceeding with a bulk requirement.';
    host.closest('.page-hero').querySelector('h1').textContent = title; host.closest('.page-hero').querySelector('p').textContent = intro;
    const source = isQuote ? 'https://suvarnatantu.com/request-quote/' : 'https://suvarnatantu.com/samples/';
    const enquiryType = isQuote ? 'Request Quote / RFQ' : 'Request Sample';
    const formSection = document.createElement('section'); formSection.className = 'content-section b2b-request-section';
    formSection.innerHTML = `<div class="wrap form-page"><form class="form b2b-request-form" data-enquiry-form>${intakeFields(source, enquiryType)}<h2 class="full">${isQuote ? 'Company information' : 'Buyer information'}</h2><label>Company Name *<input required name="company" autocomplete="organization"></label><label>Contact Person *<input required name="contact" autocomplete="name"></label><label>Business Email *<input required name="email" type="email" autocomplete="email"></label><label>Mobile / WhatsApp *<input required name="phone" type="tel" autocomplete="tel"></label><label>Country *<input required name="country" autocomplete="country-name"></label><label>State / Region *<input required name="state" autocomplete="address-level1"></label><label>City *<input required name="city" autocomplete="address-level2"></label><label>Website <input name="websiteUrl" type="url" autocomplete="url"></label>${isQuote ? '<label>GST/VAT/Tax ID <input name="taxId"></label>' : ''}<h2 class="full">${isQuote ? 'Product requirement' : 'Sample requirement'}</h2><label>Product *<input required name="product"></label><label>Category *<input required name="productType"></label>${fields()}${isQuote ? `<h2 class="full">Commercial requirement</h2><label>Target Delivery Location<input name="deliveryLocation"></label><label>Expected Requirement Date<input name="expectedDate" type="date"></label><label>Requirement Type<select name="requirementType">${options(['Trial','Regular Purchase','Bulk Purchase','Development Requirement','Export Requirement'], 'Select requirement type')}</select></label><label class="full">Additional Notes<textarea name="additionalNotes"></textarea></label>` : `<h2 class="full">Shipping information</h2><label class="full">Delivery Address *<textarea required name="address" autocomplete="street-address"></textarea></label><label>Postal Code *<input required name="postalCode" autocomplete="postal-code"></label><p class="full form-note">Sample availability, charges and dispatch details will be confirmed after requirement review.</p>`}<label class="full consent"><input required type="checkbox" name="consent" value="Agreed"> I consent to Suvarnatantu using these details to respond to this B2B ${kind} request. *</label><p class="full form-note">Your enquiry will be sent securely to the Suvarnatantu business team.</p><p class="full privacy-note">Please do not include passwords, payment card details or other highly sensitive information.</p><div class="form-errors full" aria-live="polite"></div><div class="b2b-actions full"><button class="button" type="submit" disabled data-submit-label="${isQuote ? 'Send Quote Request' : 'Send Sample Request'}">${isQuote ? 'Send Quote Request' : 'Send Sample Request'}</button><button class="button-outline" type="button" data-whatsapp>Continue on WhatsApp</button></div></form></div>`;
    host.parentElement.insertAdjacentElement('afterend', formSection);
    const form = formSection.querySelector('form'); Object.entries(stored).forEach(([key, value]) => { const control = form.elements[key]; if (control && value) control.value = value; });
    const wa = form.querySelector('[data-whatsapp]'); const refresh = () => { wa.dataset.url = whatsapp(encodeConfig(form), kind); }; wa.addEventListener('click', () => { const popup = window.open(wa.dataset.url, '_blank', 'noopener,noreferrer'); if (popup) popup.opener = null; }); form.addEventListener('input', refresh); form.addEventListener('change', refresh); refresh(); setupDeliveryForm(form);
  }
  if ((path.startsWith('/colours/') || path.startsWith('/applications/') || path.startsWith('/zari-lab/')) && path !== '/applications' && !document.querySelector('.contextual-b2b-cta')) {
    const cta = document.createElement('section'); cta.className = 'cta-band contextual-b2b-cta';
    cta.innerHTML = `<div class="wrap"><h2>Ready to discuss your requirement?</h2><p>Share the product, application and available specification context with the Suvarnatantu B2B team.</p><div class="page-actions"><a class="button" href="/request-quote/">Request Quote</a><a class="button-outline" href="/samples/">Request Sample</a></div></div>`;
    document.querySelector('main')?.append(cta);
  }
  if (path === '/') { const contact = document.querySelector('#contact'); if (contact && !document.querySelector('.b2b-sourcing')) { const s = document.createElement('section'); s.className = 'b2b-sourcing'; s.innerHTML = `<div class="wrap"><div class="eyebrow">B2B buying journey</div><h2>How to Source from Suvarnatantu</h2><div class="source-steps"><article><b>01</b><h3>Explore & Configure</h3><p>Choose your yarn type, colour and technical requirement.</p></article><article><b>02</b><h3>Request Quote or Sample</h3><p>Share quantity, application and commercial requirement.</p></article><article><b>03</b><h3>Specification & Commercial Confirmation</h3><p>Our B2B team reviews feasibility, MOQ, pricing and lead time.</p></article><article><b>04</b><h3>Proceed with Business Order</h3><p>Quotation and commercial documentation are handled with our sales team.</p></article></div><div class="page-actions"><a class="button" href="/request-quote/">Request Quote</a><a class="button-outline" href="/samples/">Request Sample</a></div></div></section>`; contact.insertAdjacentElement('beforebegin', s); } }
  document.querySelectorAll('[data-enquiry-form]').forEach(setupDeliveryForm);
})();
