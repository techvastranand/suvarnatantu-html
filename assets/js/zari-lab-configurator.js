(() => {
  'use strict';

  const root = document.querySelector('[data-zari-configurator]');
  if (!root) return;

  const STORAGE_KEY = 'suvarnatantu_zari_lab_draft';
  const REVIEW_REQUIRED = 'Technical Review Required';
  const steps = [
    'Application',
    'Yarn Type',
    'Colour & Finish',
    'Denier',
    'TPM',
    'Twist',
    'Construction',
    'Quantity & Reference'
  ];
  const allowed = {
    application: ['Saree', 'Jacquard', 'Brocade', 'Embroidery', 'Knitting', 'Lace', 'Weaving', 'Home Furnishing', 'Decorative Textiles', 'Other / Not Sure'],
    yarnType: ['M Type', 'MX Type', 'ST Type', 'MH Type', 'Custom Metallic Yarn', 'Weaving Zari', 'Embroidery Zari', 'Imitation Zari', 'Polyester Zari', 'Coloured Zari', 'Not Sure — Need Technical Review'],
    colour: ['Gold', 'Silver', 'Copper', 'Rose Gold', 'Antique', 'Coloured', 'Custom', 'Not Sure'],
    finish: ['Bright', 'Soft Metallic', 'Matte', 'Antique', 'Custom', 'Not Sure'],
    denierKnown: ['yes', 'no'],
    tpmKnown: ['yes', 'no'],
    twist: ['S Twist', 'Z Twist', 'Not Sure'],
    constructionKnown: ['yes', 'no'],
    requirementStage: ['Sample / Development', 'Trial Requirement', 'Production Requirement', 'Not Sure'],
    reference: ['Physical yarn sample', 'Fabric sample', 'Image / reference photo', 'Specification sheet', 'No reference', 'Other']
  };
  const textLimits = {
    applicationOther: 120,
    colourCustom: 400,
    denier: 60,
    tpm: 60,
    construction: 180,
    constructionNotes: 500,
    quantity: 120,
    notes: 750
  };

  const blankData = () => ({
    application: '',
    applicationOther: '',
    yarnType: '',
    colour: '',
    finish: '',
    colourCustom: '',
    denierKnown: '',
    denier: '',
    tpmKnown: '',
    tpm: '',
    twist: '',
    constructionKnown: '',
    construction: '',
    constructionNotes: '',
    requirementStage: '',
    quantity: '',
    reference: '',
    notes: ''
  });
  const freshState = () => ({ version: 1, currentStep: 0, highestStep: 0, view: 'steps', data: blankData() });

  const cleanText = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
  const loadState = () => {
    let parsed;
    try {
      parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_error) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_storageError) { /* Storage may be unavailable. */ }
      return freshState();
    }
    if (!parsed || parsed.version !== 1 || typeof parsed.data !== 'object') return freshState();
    const next = freshState();
    Object.keys(allowed).forEach(key => {
      next.data[key] = allowed[key].includes(parsed.data[key]) ? parsed.data[key] : '';
    });
    Object.entries(textLimits).forEach(([key, limit]) => {
      next.data[key] = cleanText(parsed.data[key], limit);
    });
    next.currentStep = Number.isInteger(parsed.currentStep) ? Math.min(7, Math.max(0, parsed.currentStep)) : 0;
    next.highestStep = Number.isInteger(parsed.highestStep) ? Math.min(7, Math.max(next.currentStep, parsed.highestStep)) : next.currentStep;
    const summaryIsComplete = next.data.application && next.data.yarnType && next.data.colour && next.data.finish
      && next.data.denierKnown && (next.data.denierKnown !== 'yes' || next.data.denier.trim())
      && next.data.tpmKnown && (next.data.tpmKnown !== 'yes' || next.data.tpm.trim())
      && next.data.twist && next.data.constructionKnown
      && (next.data.constructionKnown !== 'yes' || next.data.construction.trim())
      && next.data.requirementStage && next.data.reference;
    next.view = parsed.view === 'summary' && summaryIsComplete ? 'summary' : 'steps';
    if (next.view === 'summary') next.highestStep = 7;
    return next;
  };

  let state = loadState();
  let lastFocusedElement = null;
  let navigating = false;
  const form = root.querySelector('[data-configurator-form]');
  const stepContent = root.querySelector('[data-step-content]');
  const stepError = root.querySelector('[data-step-error]');
  const summary = root.querySelector('[data-summary]');
  const confirmation = root.querySelector('[data-reset-confirmation]');

  const saveState = () => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_error) { /* Continue with in-memory state. */ }
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-requirement-updated'));
  };

  const choiceCards = (name, values, modifier = '') => `
    <div class="zlh-choice-grid ${modifier}">
      ${values.map(value => `<label class="zlh-choice"><input type="radio" name="${name}" value="${value}"><span><strong>${value}</strong></span></label>`).join('')}
    </div>`;

  const stepTemplates = [
    () => `
      <div class="zlh-step" data-step="1">
        <div class="zlh-step__number">Step 01</div>
        <h3 id="zlh-step-heading" tabindex="-1">What are you making?</h3>
        <p>Choose the textile application for which you are evaluating the yarn.</p>
        <fieldset><legend class="zlh-visually-hidden">Textile application</legend>${choiceCards('application', allowed.application)}</fieldset>
        <div class="zlh-conditional" data-condition="application:Other / Not Sure" hidden>
          <label for="zlh-application-other">Describe the application <span>Optional</span></label>
          <input id="zlh-application-other" name="applicationOther" type="text" maxlength="120" autocomplete="off">
        </div>
      </div>`,
    () => `
      <div class="zlh-step" data-step="2">
        <div class="zlh-step__number">Step 02</div>
        <h3 id="zlh-step-heading" tabindex="-1">Which yarn direction are you exploring?</h3>
        <p>Select a verified Suvarnatantu product family, or continue with technical review.</p>
        <fieldset><legend class="zlh-visually-hidden">Yarn type</legend>${choiceCards('yarnType', allowed.yarnType)}</fieldset>
        <p class="zlh-step__helper" data-yarn-review hidden>You can continue without selecting a technical product type. Our team can review your application and reference.</p>
      </div>`,
    () => `
      <div class="zlh-step" data-step="3">
        <div class="zlh-step__number">Step 03</div>
        <h3 id="zlh-step-heading" tabindex="-1">Choose your colour direction</h3>
        <p>Select a broad colour direction and preferred finish.</p>
        <fieldset><legend>Colour direction</legend>${choiceCards('colour', allowed.colour, 'zlh-choice-grid--compact')}</fieldset>
        <fieldset><legend>Preferred finish</legend>${choiceCards('finish', allowed.finish, 'zlh-choice-grid--compact')}</fieldset>
        <div class="zlh-conditional" data-colour-custom hidden>
          <label for="zlh-colour-custom">Describe the colour or finish <span>Optional</span></label>
          <input id="zlh-colour-custom" name="colourCustom" type="text" maxlength="400" autocomplete="off">
        </div>
        <p class="zlh-step__helper">Digital colour selection is indicative. Final colour and appearance should be confirmed through sample review.</p>
      </div>`,
    () => `
      <div class="zlh-step" data-step="4">
        <div class="zlh-step__number">Step 04</div>
        <h3 id="zlh-step-heading" tabindex="-1">Do you know the required denier?</h3>
        <fieldset><legend class="zlh-visually-hidden">Denier knowledge</legend>${choiceCards('denierKnown', ['yes', 'no'], 'zlh-choice-grid--binary').replace('<strong>yes</strong>', '<strong>Yes, I know the denier</strong>').replace('<strong>no</strong>', '<strong>No — Technical Review Required</strong>')}</fieldset>
        <div class="zlh-conditional" data-condition="denierKnown:yes" hidden>
          <label for="zlh-denier">Denier</label>
          <input id="zlh-denier" name="denier" type="text" maxlength="60" inputmode="decimal" autocomplete="off">
        </div>
        <p class="zlh-step__helper">Denier is one part of the yarn specification and should be reviewed together with construction and application.</p>
        <a class="zlh-step__learn" href="/zari-lab/denier/">Learn about Denier <span aria-hidden="true">&rarr;</span></a>
      </div>`,
    () => `
      <div class="zlh-step" data-step="5">
        <div class="zlh-step__number">Step 05</div>
        <h3 id="zlh-step-heading" tabindex="-1">Do you know the required TPM?</h3>
        <fieldset><legend class="zlh-visually-hidden">TPM knowledge</legend>${choiceCards('tpmKnown', ['yes', 'no'], 'zlh-choice-grid--binary').replace('<strong>yes</strong>', '<strong>Yes, I know the TPM</strong>').replace('<strong>no</strong>', '<strong>No — Technical Review Required</strong>')}</fieldset>
        <div class="zlh-conditional" data-condition="tpmKnown:yes" hidden>
          <label for="zlh-tpm">TPM</label>
          <input id="zlh-tpm" name="tpm" type="text" maxlength="60" inputmode="decimal" autocomplete="off">
        </div>
        <p class="zlh-step__helper">TPM should be reviewed together with yarn construction, twist and intended application.</p>
        <a class="zlh-step__learn" href="/zari-lab/tpm/">Learn about TPM <span aria-hidden="true">&rarr;</span></a>
      </div>`,
    () => `
      <div class="zlh-step" data-step="6">
        <div class="zlh-step__number">Step 06</div>
        <h3 id="zlh-step-heading" tabindex="-1">Do you know the twist direction?</h3>
        <fieldset><legend class="zlh-visually-hidden">Twist direction</legend>${choiceCards('twist', allowed.twist, 'zlh-choice-grid--twist')}</fieldset>
        <p class="zlh-step__helper">If you are unsure, continue with “Not Sure” and provide a physical or visual reference where available.</p>
        <a class="zlh-step__learn" href="/zari-lab/twist/">Understand S &amp; Z Twist <span aria-hidden="true">&rarr;</span></a>
      </div>`,
    () => `
      <div class="zlh-step" data-step="7">
        <div class="zlh-step__number">Step 07</div>
        <h3 id="zlh-step-heading" tabindex="-1">Do you know the yarn construction?</h3>
        <fieldset><legend class="zlh-visually-hidden">Construction knowledge</legend>${choiceCards('constructionKnown', ['yes', 'no'], 'zlh-choice-grid--binary').replace('<strong>yes</strong>', '<strong>Yes</strong>').replace('<strong>no</strong>', '<strong>No — Technical Review Required</strong>')}</fieldset>
        <div class="zlh-conditional zlh-field-stack" data-condition="constructionKnown:yes" hidden>
          <label for="zlh-construction">Enter known construction</label>
          <input id="zlh-construction" name="construction" type="text" maxlength="180" autocomplete="off">
          <label for="zlh-construction-notes">Additional construction notes <span>Optional</span></label>
          <textarea id="zlh-construction-notes" name="constructionNotes" maxlength="500"></textarea>
        </div>
        <a class="zlh-step__learn" href="/zari-lab/yarn-construction/">Learn about Yarn Construction <span aria-hidden="true">&rarr;</span></a>
      </div>`,
    () => `
      <div class="zlh-step" data-step="8">
        <div class="zlh-step__number">Step 08</div>
        <h3 id="zlh-step-heading" tabindex="-1">Tell us about the requirement</h3>
        <fieldset><legend>Requirement Stage</legend>${choiceCards('requirementStage', allowed.requirementStage, 'zlh-choice-grid--compact')}</fieldset>
        <div class="zlh-conditional zlh-field-stack zlh-field-stack--always">
          <label for="zlh-quantity">Approximate Quantity <span>Optional</span></label>
          <input id="zlh-quantity" name="quantity" type="text" maxlength="120" autocomplete="off" placeholder="Enter quantity and unit if known">
        </div>
        <fieldset><legend>Reference Available?</legend>${choiceCards('reference', allowed.reference, 'zlh-choice-grid--compact')}</fieldset>
        <div class="zlh-conditional zlh-field-stack zlh-field-stack--always">
          <label for="zlh-notes">Additional requirement or reference notes <span>Optional</span></label>
          <textarea id="zlh-notes" name="notes" maxlength="750"></textarea>
          <small><span data-notes-count>0</span> / 750 characters</small>
        </div>
        <p class="zlh-step__helper">Prepare reference details separately, then include them in your Sample or RFQ enquiry.</p>
      </div>`
  ];

  const setElementVisibility = (element, visible) => {
    if (!element) return;
    element.hidden = !visible;
    element.querySelectorAll('input, textarea, select').forEach(control => { control.disabled = !visible; });
  };

  const syncConditionals = () => {
    stepContent.querySelectorAll('[data-condition]').forEach(element => {
      const [key, expected] = element.dataset.condition.split(':');
      setElementVisibility(element, state.data[key] === expected);
    });
    setElementVisibility(stepContent.querySelector('[data-colour-custom]'), state.data.colour === 'Custom' || state.data.finish === 'Custom');
    const yarnReview = stepContent.querySelector('[data-yarn-review]');
    if (yarnReview) yarnReview.hidden = state.data.yarnType !== 'Not Sure — Need Technical Review';
    const count = stepContent.querySelector('[data-notes-count]');
    if (count) count.textContent = String(state.data.notes.length);
  };

  const hydrateControls = () => {
    stepContent.querySelectorAll('input, textarea, select').forEach(control => {
      if (!Object.prototype.hasOwnProperty.call(state.data, control.name)) return;
      if (control.type === 'radio') control.checked = state.data[control.name] === control.value;
      else control.value = state.data[control.name];
    });
    syncConditionals();
  };

  const updateProgress = () => {
    const isSummary = state.view === 'summary';
    const position = isSummary ? 8 : state.currentStep + 1;
    root.querySelector('[data-progress-label]').textContent = isSummary ? 'Requirement summary' : `Step ${position} of 8`;
    root.querySelector('[data-progress-name]').textContent = isSummary ? 'Review' : steps[state.currentStep];
    const progress = root.querySelector('[role="progressbar"]');
    progress.setAttribute('aria-valuenow', String(position));
    progress.setAttribute('aria-valuetext', isSummary ? 'Requirement summary' : `Step ${position} of 8: ${steps[state.currentStep]}`);
    root.querySelector('[data-progress-fill]').style.width = `${(position / 8) * 100}%`;
    root.querySelector('[data-draft-status]').textContent = isSummary ? 'Requirement Draft' : 'In progress';
  };

  const renderNavigation = () => {
    const list = root.querySelector('[data-step-nav]');
    list.replaceChildren();
    steps.forEach((name, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const available = state.view === 'summary' || index <= state.highestStep;
      const current = state.view === 'steps' && index === state.currentStep;
      const complete = state.view === 'summary' || (index <= state.highestStep && index !== state.currentStep);
      button.type = 'button';
      button.dataset.stepTarget = String(index);
      button.disabled = !available;
      if (current) button.setAttribute('aria-current', 'step');
      button.className = `${current ? 'is-current ' : ''}${complete ? 'is-complete' : ''}`.trim();
      const number = document.createElement('span');
      number.textContent = complete ? '✓' : String(index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');
      const label = document.createElement('strong');
      label.textContent = name;
      const status = document.createElement('em');
      status.textContent = current ? 'Current step' : complete ? 'Completed — edit' : available ? 'Available' : 'Not yet available';
      button.append(number, label, status);
      item.append(button);
      list.append(item);
    });
  };

  const focusHeading = () => {
    window.requestAnimationFrame(() => root.querySelector('#zlh-step-heading, #zlh-summary-title')?.focus({ preventScroll: true }));
  };

  const renderStep = (moveFocus = false) => {
    state.view = 'steps';
    form.hidden = false;
    summary.hidden = true;
    stepContent.innerHTML = stepTemplates[state.currentStep]();
    hydrateControls();
    stepError.hidden = true;
    const previous = root.querySelector('[data-previous]');
    previous.hidden = state.currentStep === 0;
    const next = root.querySelector('[data-next]');
    next.innerHTML = state.currentStep === 7 ? 'Review Requirement <span aria-hidden="true">&rarr;</span>' : 'Continue <span aria-hidden="true">&rarr;</span>';
    renderNavigation();
    updateProgress();
    saveState();
    if (moveFocus) focusHeading();
  };

  const makeSummaryGroup = (title, stepIndex, rows) => {
    const group = document.createElement('section');
    group.className = 'zlh-summary__group';
    const header = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = title;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.dataset.editStep = String(stepIndex);
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit ${title}`);
    header.append(heading, edit);
    const details = document.createElement('dl');
    rows.forEach(([term, value]) => {
      const termElement = document.createElement('dt');
      termElement.textContent = term;
      const valueElement = document.createElement('dd');
      valueElement.textContent = value || 'Not provided';
      details.append(termElement, valueElement);
    });
    group.append(header, details);
    return group;
  };

  const displayApplication = () => state.data.application === 'Other / Not Sure' && state.data.applicationOther
    ? `${state.data.application} — ${state.data.applicationOther}`
    : state.data.application;
  const displayReviewValue = (known, value) => known === 'yes' ? value : REVIEW_REQUIRED;

  const renderSummary = (moveFocus = false) => {
    state.view = 'summary';
    state.highestStep = 7;
    form.hidden = true;
    summary.hidden = false;
    summary.replaceChildren();

    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Requirement Draft';
    const heading = document.createElement('h2');
    heading.id = 'zlh-summary-title';
    heading.tabIndex = -1;
    heading.textContent = 'Your Zari Requirement';
    const disclaimer = document.createElement('p');
    disclaimer.className = 'zlh-summary__disclaimer';
    disclaimer.textContent = 'This summary records the information you provided. Final yarn specification, suitability, colour and construction should be reviewed with the Suvarnatantu technical team and confirmed through sampling where appropriate.';
    const groups = document.createElement('div');
    groups.className = 'zlh-summary__groups';
    groups.append(
      makeSummaryGroup('Application', 0, [['Application', displayApplication()]]),
      makeSummaryGroup('Yarn Type', 1, [['Yarn Type', state.data.yarnType]]),
      makeSummaryGroup('Colour & Finish', 2, [['Colour', state.data.colour], ['Finish', state.data.finish], ['Custom direction', state.data.colourCustom]]),
      makeSummaryGroup('Denier', 3, [['Denier', displayReviewValue(state.data.denierKnown, state.data.denier)]]),
      makeSummaryGroup('TPM', 4, [['TPM', displayReviewValue(state.data.tpmKnown, state.data.tpm)]]),
      makeSummaryGroup('Twist', 5, [['Twist', state.data.twist]]),
      makeSummaryGroup('Construction', 6, [['Construction', displayReviewValue(state.data.constructionKnown, state.data.construction)], ['Additional notes', state.data.constructionNotes]]),
      makeSummaryGroup('Quantity & Reference', 7, [['Requirement Stage', state.data.requirementStage], ['Approximate Quantity', state.data.quantity], ['Reference', state.data.reference], ['Notes', state.data.notes]])
    );
    const actions = document.createElement('div');
    actions.className = 'zlh-summary__actions';
    const sample = document.createElement('a');
    sample.className = 'button';
    sample.href = '/samples/';
    sample.innerHTML = 'Request a Sample <span aria-hidden="true">&rarr;</span>';
    const quote = document.createElement('a');
    quote.className = 'button-outline';
    quote.href = '/request-quote/';
    quote.innerHTML = 'Continue to RFQ <span aria-hidden="true">&rarr;</span>';
    const brief = document.createElement('a');
    brief.className = 'button-outline';
    brief.href = '#requirement-brief';
    brief.textContent = 'View Requirement Brief';
    const reset = document.createElement('button');
    reset.className = 'zlh-summary__reset';
    reset.type = 'button';
    reset.dataset.startAgain = '';
    reset.textContent = 'Start Again';
    actions.append(sample, quote, brief, reset);
    summary.append(eyebrow, heading, disclaimer, groups, actions);
    renderNavigation();
    updateProgress();
    saveState();
    if (moveFocus) focusHeading();
  };

  const showError = (message, selector) => {
    stepError.textContent = message;
    stepError.hidden = false;
    const target = stepContent.querySelector(selector);
    target?.focus();
    return false;
  };

  const validateStep = () => {
    const checks = [
      () => state.data.application || showError('Choose an application, including “Other / Not Sure” if needed.', '[name="application"]'),
      () => state.data.yarnType || showError('Choose a yarn direction, including technical review if needed.', '[name="yarnType"]'),
      () => (state.data.colour && state.data.finish) || showError('Choose both a colour direction and preferred finish.', `[name="${state.data.colour ? 'finish' : 'colour'}"]`),
      () => state.data.denierKnown && (state.data.denierKnown !== 'yes' || state.data.denier.trim()) || showError(state.data.denierKnown ? 'Enter the known denier or choose Technical Review Required.' : 'Choose whether the denier is known.', state.data.denierKnown === 'yes' ? '[name="denier"]' : '[name="denierKnown"]'),
      () => state.data.tpmKnown && (state.data.tpmKnown !== 'yes' || state.data.tpm.trim()) || showError(state.data.tpmKnown ? 'Enter the known TPM or choose Technical Review Required.' : 'Choose whether the TPM is known.', state.data.tpmKnown === 'yes' ? '[name="tpm"]' : '[name="tpmKnown"]'),
      () => state.data.twist || showError('Choose a twist direction, including “Not Sure” if needed.', '[name="twist"]'),
      () => state.data.constructionKnown && (state.data.constructionKnown !== 'yes' || state.data.construction.trim()) || showError(state.data.constructionKnown ? 'Enter the known construction or choose Technical Review Required.' : 'Choose whether the construction is known.', state.data.constructionKnown === 'yes' ? '[name="construction"]' : '[name="constructionKnown"]'),
      () => (state.data.requirementStage && state.data.reference) || showError('Choose both a requirement stage and reference status.', `[name="${state.data.requirementStage ? 'reference' : 'requirementStage'}"]`)
    ];
    return Boolean(checks[state.currentStep]());
  };

  const goToStep = (index, moveFocus = true) => {
    if (navigating || index < 0 || index > state.highestStep) return;
    navigating = true;
    state.currentStep = index;
    renderStep(moveFocus);
    navigating = false;
  };

  const openConfirmation = trigger => {
    lastFocusedElement = trigger;
    confirmation.hidden = false;
    document.body.classList.add('zlh-confirmation-open');
    confirmation.querySelector('[data-reset-cancel]').focus();
  };
  const closeConfirmation = () => {
    confirmation.hidden = true;
    document.body.classList.remove('zlh-confirmation-open');
    lastFocusedElement?.focus();
  };

  form.addEventListener('input', event => {
    const control = event.target;
    if (!control.name || control.type === 'radio') return;
    if (!Object.prototype.hasOwnProperty.call(state.data, control.name)) return;
    state.data[control.name] = cleanText(control.value, textLimits[control.name] || 750);
    stepError.hidden = true;
    syncConditionals();
    saveState();
  });

  form.addEventListener('change', event => {
    const control = event.target;
    if (!control.name || !Object.prototype.hasOwnProperty.call(state.data, control.name)) return;
    state.data[control.name] = cleanText(control.value, textLimits[control.name] || 180);
    stepError.hidden = true;
    syncConditionals();
    saveState();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (navigating || !validateStep()) return;
    navigating = true;
    if (state.currentStep === 7) {
      renderSummary(true);
    } else {
      state.currentStep += 1;
      state.highestStep = Math.max(state.highestStep, state.currentStep);
      renderStep(true);
    }
    navigating = false;
  });

  root.addEventListener('click', event => {
    const previous = event.target.closest('[data-previous]');
    if (previous) { goToStep(state.currentStep - 1); return; }
    const stepButton = event.target.closest('[data-step-target]');
    if (stepButton && !stepButton.disabled) { goToStep(Number(stepButton.dataset.stepTarget)); return; }
    const edit = event.target.closest('[data-edit-step]');
    if (edit) { goToStep(Number(edit.dataset.editStep)); return; }
    const startAgain = event.target.closest('[data-start-again]');
    if (startAgain) { openConfirmation(startAgain); return; }
    if (event.target.closest('[data-reset-cancel]')) { closeConfirmation(); return; }
    if (event.target.closest('[data-reset-confirm]')) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_error) { /* Storage may be unavailable. */ }
      confirmation.hidden = true;
      document.body.classList.remove('zlh-confirmation-open');
      state = freshState();
      renderStep(true);
    }
  });

  confirmation.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeConfirmation(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(confirmation.querySelectorAll('button:not([disabled])'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  document.querySelectorAll('[data-zlh-application]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const application = link.dataset.zlhApplication;
      if (!allowed.application.includes(application)) return;
      state.data.application = application;
      state.currentStep = 0;
      state.highestStep = Math.max(state.highestStep, 0);
      renderStep();
      root.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      window.setTimeout(focusHeading, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300);
    });
  });

  document.addEventListener('suvarnatantu:zari-colour-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({
      colour: state.data.colour,
      finish: state.data.finish,
      colourCustom: state.data.colourCustom
    });
  });

  document.addEventListener('suvarnatantu:zari-colour-apply', event => {
    const colour = event.detail?.colour;
    const finish = event.detail?.finish;
    if (!allowed.colour.includes(colour) || !allowed.finish.includes(finish)) return;
    state.data.colour = colour;
    state.data.finish = finish;
    state.data.colourCustom = cleanText(event.detail?.colourCustom, textLimits.colourCustom);
    if (state.view === 'summary') renderSummary();
    else if (state.currentStep === 2) renderStep();
    else saveState();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-colour-applied', {
      detail: { colour: state.data.colour, finish: state.data.finish }
    }));
  });

  document.addEventListener('suvarnatantu:zari-twist-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({ twist: state.data.twist });
  });

  document.addEventListener('suvarnatantu:zari-twist-apply', event => {
    const twist = event.detail?.twist;
    if (!allowed.twist.includes(twist)) return;
    state.data.twist = twist;
    if (state.view === 'summary') renderSummary();
    else if (state.currentStep === 5) renderStep();
    else saveState();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-twist-applied', {
      detail: { twist: state.data.twist }
    }));
  });

  document.addEventListener('suvarnatantu:zari-tpm-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({ tpmKnown: state.data.tpmKnown, tpm: state.data.tpm });
  });

  document.addEventListener('suvarnatantu:zari-tpm-apply', event => {
    const tpmKnown = event.detail?.tpmKnown;
    if (!allowed.tpmKnown.includes(tpmKnown)) return;
    const tpm = tpmKnown === 'yes' ? cleanText(event.detail?.tpm, 12) : '';
    if (tpmKnown === 'yes' && (!/^\d+(?:\.\d+)?$/.test(tpm) || Number(tpm) <= 0)) return;
    state.data.tpmKnown = tpmKnown;
    state.data.tpm = tpm;
    if (state.view === 'summary') renderSummary();
    else if (state.currentStep === 4) renderStep();
    else saveState();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-tpm-applied', {
      detail: { tpmKnown: state.data.tpmKnown, tpm: state.data.tpm }
    }));
  });

  document.addEventListener('suvarnatantu:zari-denier-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({ denierKnown: state.data.denierKnown, denier: state.data.denier });
  });

  document.addEventListener('suvarnatantu:zari-denier-apply', event => {
    const denierKnown = event.detail?.denierKnown;
    if (!allowed.denierKnown.includes(denierKnown)) return;
    const denier = denierKnown === 'yes' ? cleanText(event.detail?.denier, 12) : '';
    if (denierKnown === 'yes' && (!/^\d+(?:\.\d+)?$/.test(denier) || Number(denier) <= 0)) return;
    state.data.denierKnown = denierKnown;
    state.data.denier = denier;
    if (state.view === 'summary') renderSummary();
    else if (state.currentStep === 3) renderStep();
    else saveState();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-denier-applied', {
      detail: { denierKnown: state.data.denierKnown, denier: state.data.denier }
    }));
  });

  document.addEventListener('suvarnatantu:zari-construction-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({
      constructionKnown: state.data.constructionKnown,
      construction: state.data.construction,
      constructionNotes: state.data.constructionNotes
    });
  });

  document.addEventListener('suvarnatantu:zari-construction-apply', event => {
    const constructionKnown = event.detail?.constructionKnown;
    if (!allowed.constructionKnown.includes(constructionKnown)) return;
    const normalizeWhitespace = (value, limit) => cleanText(value, limit).replace(/\s+/g, ' ').trim();
    const construction = constructionKnown === 'yes' ? normalizeWhitespace(event.detail?.construction, textLimits.construction) : '';
    const constructionNotes = constructionKnown === 'yes' ? normalizeWhitespace(event.detail?.constructionNotes, textLimits.constructionNotes) : '';
    if (constructionKnown === 'yes' && !construction) return;
    state.data.constructionKnown = constructionKnown;
    state.data.construction = construction;
    state.data.constructionNotes = constructionNotes;
    if (state.view === 'summary') renderSummary();
    else if (state.currentStep === 6) renderStep();
    else saveState();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-construction-applied', {
      detail: {
        constructionKnown: state.data.constructionKnown,
        construction: state.data.construction,
        constructionNotes: state.data.constructionNotes
      }
    }));
  });

  document.addEventListener('suvarnatantu:zari-requirement-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({ ...state.data });
  });

  if (state.view === 'summary') renderSummary();
  else renderStep();
})();
