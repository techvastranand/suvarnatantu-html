(() => {
  'use strict';

  const root = document.querySelector('[data-troubleshooting-lab]');
  if (!root || root.dataset.troubleshootingReady === 'true') return;
  root.dataset.troubleshootingReady = 'true';

  const STORAGE_KEY = 'suvarnatantu_zari_lab_troubleshooting';
  const steps = ['Problem Category', 'What Are You Seeing?', 'Desired Result', 'Known Information', 'Reference', 'Review Brief'];
  const categories = [
    'Colour / Appearance', 'Metallic Shine / Finish', 'Yarn Breakage Concern', 'Twist Concern',
    'TPM Concern', 'Denier Concern', 'Construction Concern', 'Existing Sample Matching',
    'Yarn Type / Product Selection', 'Production Consistency Concern', 'Not Sure', 'Other'
  ];
  const desiredResults = [
    'Match an existing reference', 'Change colour direction', 'Change metallic appearance',
    'Review yarn construction', 'Review denier', 'Review TPM', 'Review twist direction',
    'Explore another product type', 'Develop a new sample', 'Understand current specification',
    'Not Sure', 'Other'
  ];
  const requirementStages = ['Early Development', 'Sample Review', 'Trial', 'Production Discussion', 'Existing Production Concern'];
  const references = ['Yarn Photo', 'Fabric Photo', 'Specification Sheet', 'Physical Yarn Sample', 'Fabric Sample', 'Existing Product Reference', 'No Reference', 'Not Sure'];
  const knownFieldNames = ['yarnType', 'colourFinish', 'denier', 'tpm', 'twist', 'construction', 'application', 'quantity', 'existingSpecification', 'none'];
  const observations = {
    'Colour / Appearance': ['Too bright', 'Too muted', 'Different colour direction', 'Uneven visual appearance', 'Existing sample looks different', 'Not Sure', 'Other'],
    'Metallic Shine / Finish': ['More shine needed', 'Less shine needed', 'Softer metallic appearance wanted', 'More antique appearance wanted', 'Existing reference not matching', 'Not Sure', 'Other'],
    'Yarn Breakage Concern': ['Breakage observed during trial', 'Breakage observed during production', 'Breakage stage is uncertain', 'Existing sample behaves differently', 'Not Sure', 'Other'],
    'Twist Concern': ['Twist direction uncertain', 'Existing specification says S', 'Existing specification says Z', 'Twist appearance seems different', 'Not Sure', 'Other'],
    'TPM Concern': ['Known TPM needs review', 'TPM is not known', 'Existing specification and yarn appear different', 'Current requirement needs clarification', 'Not Sure', 'Other'],
    'Denier Concern': ['Known denier needs review', 'Denier is not known', 'Existing specification and yarn appear different', 'Current requirement needs clarification', 'Not Sure', 'Other'],
    'Construction Concern': ['Construction is not known', 'Existing construction needs review', 'Yarn structure appears different from reference', 'Specification wording needs clarification', 'Not Sure', 'Other'],
    'Existing Sample Matching': ['Yarn sample looks different', 'Fabric appearance looks different', 'Colour direction looks different', 'Metallic finish looks different', 'Specification is not available', 'Not Sure', 'Other'],
    'Yarn Type / Product Selection': ['Product or yarn type is not known', 'Existing yarn type needs review', 'Another product type is being explored', 'Application needs technical review', 'Not Sure', 'Other'],
    'Production Consistency Concern': ['Appearance varies between production', 'Yarn behaviour appears different', 'Specification appears unchanged', 'A production change was observed', 'Not Sure', 'Other'],
    'Not Sure': ['Appearance or performance concern', 'Requirement is difficult to describe', 'Current result differs from expectation', 'Technical information is not available', 'Not Sure', 'Other'],
    Other: ['Current result differs from expectation', 'Existing reference is not matching', 'Requirement needs technical review', 'Not Sure', 'Other']
  };

  const blankData = () => ({
    category: '', categoryOther: '', observation: '', observationOther: '', productionNote: '',
    breakageStage: '', breakageSample: '', breakageSpecification: '', breakageApplication: '',
    desiredResult: '', desiredNote: '', requirementStage: '', knownFields: [],
    knownYarnType: '', knownColour: '', knownFinish: '', knownDenier: '', knownTpm: '',
    knownTwist: '', knownConstruction: '', knownApplication: '', knownQuantity: '', knownSpecification: '',
    usedConfigurator: false, reference: '', useReferenceDraft: false, referenceDraftLabel: ''
  });
  const freshState = () => ({ version: 1, activeStep: 0, highestStep: 0, view: 'steps', data: blankData() });
  const textLimits = {
    categoryOther: 160, observationOther: 600, productionNote: 600, desiredNote: 700,
    knownYarnType: 120, knownColour: 120, knownFinish: 120, knownDenier: 60, knownTpm: 60,
    knownTwist: 30, knownConstruction: 300, knownApplication: 120, knownQuantity: 120,
    knownSpecification: 500, referenceDraftLabel: 240
  };
  const cleanText = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';

  const loadState = () => {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch (_error) { saved = null; }
    if (!saved || saved.version !== 1 || typeof saved.data !== 'object') return freshState();
    const next = freshState();
    next.activeStep = Number.isInteger(saved.activeStep) ? Math.max(0, Math.min(5, saved.activeStep)) : 0;
    next.highestStep = Number.isInteger(saved.highestStep) ? Math.max(next.activeStep, Math.min(5, saved.highestStep)) : next.activeStep;
    next.view = saved.view === 'summary' ? 'summary' : 'steps';
    const data = saved.data;
    next.data.category = categories.includes(data.category) ? data.category : '';
    next.data.observation = (observations[next.data.category] || []).includes(data.observation) ? data.observation : '';
    next.data.desiredResult = desiredResults.includes(data.desiredResult) ? data.desiredResult : '';
    next.data.requirementStage = requirementStages.includes(data.requirementStage) ? data.requirementStage : '';
    next.data.reference = references.includes(data.reference) ? data.reference : '';
    next.data.knownFields = Array.isArray(data.knownFields) ? data.knownFields.filter(value => knownFieldNames.includes(value)) : [];
    Object.entries(textLimits).forEach(([name, limit]) => { next.data[name] = cleanText(data[name], limit); });
    ['breakageStage', 'breakageSample', 'breakageSpecification', 'breakageApplication'].forEach(name => {
      next.data[name] = cleanText(data[name], 120);
    });
    next.data.usedConfigurator = data.usedConfigurator === true;
    next.data.useReferenceDraft = data.useReferenceDraft === true;
    if (next.view === 'summary' && (!next.data.category || !next.data.observation || !next.data.desiredResult || !next.data.reference)) {
      next.view = 'steps';
      next.activeStep = Math.min(next.activeStep, 4);
    }
    return next;
  };

  let state = loadState();
  let lastFocusedElement = null;
  const form = root.querySelector('[data-troubleshooting-form]');
  const summary = root.querySelector('[data-troubleshooting-summary]');
  const error = root.querySelector('[data-troubleshooting-error]');
  const confirmation = root.querySelector('[data-troubleshooting-confirmation]');
  const live = root.querySelector('[data-troubleshooting-live]');

  const saveState = () => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_error) { /* Continue in memory when storage is unavailable. */ }
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-troubleshooting-updated'));
  };

  const query = eventName => {
    let response = null;
    document.dispatchEvent(new CustomEvent(eventName, { detail: { respond: value => { if (value && typeof value === 'object') response = value; } } }));
    return response;
  };

  const getConfigurator = () => query('suvarnatantu:zari-requirement-query');
  const hasConfiguratorData = data => Boolean(data && [
    data.application, data.yarnType, data.colour, data.finish, data.denierKnown, data.tpmKnown,
    data.twist, data.constructionKnown, data.quantity
  ].some(value => typeof value === 'string' && value.trim()));

  const setControlValue = (name, value) => {
    const controls = form.elements[name];
    if (!controls) return;
    if (controls instanceof RadioNodeList || (typeof controls.length === 'number' && !controls.tagName)) {
      Array.from(controls).forEach(control => {
        if (control.type === 'radio') control.checked = control.value === value;
      });
      return;
    }
    controls.value = value;
  };

  const selectKnownField = name => {
    if (!knownFieldNames.includes(name)) return;
    if (name === 'none') state.data.knownFields = ['none'];
    else {
      state.data.knownFields = state.data.knownFields.filter(value => value !== 'none');
      if (!state.data.knownFields.includes(name)) state.data.knownFields.push(name);
    }
  };

  const renderObservationOptions = () => {
    const container = root.querySelector('[data-observation-options]');
    container.replaceChildren();
    (observations[state.data.category] || observations['Not Sure']).forEach(value => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      const visual = document.createElement('span');
      input.type = 'radio';
      input.name = 'observation';
      input.value = value;
      input.checked = state.data.observation === value;
      visual.textContent = value;
      label.append(input, visual);
      container.append(label);
    });
  };

  const updateConditionals = () => {
    const showCategoryOther = state.data.category === 'Other';
    root.querySelector('[data-category-other-wrap]').hidden = !showCategoryOther;
    form.elements.categoryOther.disabled = !showCategoryOther;
    root.querySelector('[data-sample-match-note]').hidden = state.data.category !== 'Existing Sample Matching';

    const showObservationOther = state.data.observation === 'Other';
    root.querySelector('[data-observation-other-wrap]').hidden = !showObservationOther;
    form.elements.observationOther.disabled = !showObservationOther;
    const breakage = state.data.category === 'Yarn Breakage Concern';
    root.querySelector('[data-breakage-fields]').hidden = !breakage;
    root.querySelectorAll('[data-breakage-fields] select').forEach(control => { control.disabled = !breakage; });
    const production = state.data.category === 'Production Consistency Concern' || state.data.requirementStage === 'Existing Production Concern';
    root.querySelector('[data-production-note-wrap]').hidden = !production;
    form.elements.productionNote.disabled = !production;

    root.querySelectorAll('[data-known-field]').forEach(element => {
      const visible = state.data.knownFields.includes(element.dataset.knownField);
      element.hidden = !visible;
      element.querySelectorAll('input, select, textarea').forEach(control => { control.disabled = !visible; });
      if (element.matches('label, fieldset')) element.querySelectorAll(':scope > input, :scope > select, :scope > textarea').forEach(control => { control.disabled = !visible; });
    });
    const imports = {
      '[data-use-colour]': state.data.category === 'Colour / Appearance' || state.data.category === 'Metallic Shine / Finish',
      '[data-use-twist]': state.data.category === 'Twist Concern',
      '[data-use-tpm]': state.data.category === 'TPM Concern',
      '[data-use-denier]': state.data.category === 'Denier Concern',
      '[data-use-construction]': state.data.category === 'Construction Concern'
    };
    Object.entries(imports).forEach(([selector, visible]) => { root.querySelector(selector).hidden = !visible; });

    root.querySelector('[data-observation-count]').textContent = String(state.data.observationOther.length);
    root.querySelector('[data-desired-count]').textContent = String(state.data.desiredNote.length);
  };

  const hydrate = () => {
    Array.from(form.elements).forEach(control => {
      if (!control.name || control.name === 'knownField') return;
      const value = state.data[control.name];
      if (control.type === 'radio') control.checked = control.value === value;
      else if (typeof value === 'string') control.value = value;
    });
    root.querySelectorAll('[name="knownField"]').forEach(control => { control.checked = state.data.knownFields.includes(control.value); });
    renderObservationOptions();
    updateConditionals();
  };

  const refreshAvailability = () => {
    const configurator = getConfigurator();
    const available = hasConfiguratorData(configurator);
    const button = root.querySelector('[data-use-configurator]');
    button.disabled = !available;
    root.querySelector('[data-configurator-availability]').textContent = available
      ? 'Your Build Your Zari details are available. Use them here without changing the original requirement.'
      : 'No Build Your Zari requirement is currently available.';

    const referenceDraft = query('suvarnatantu:zari-reference-query');
    const referenceAvailable = Boolean(referenceDraft && (referenceDraft.fileCount || referenceDraft.referenceTypes?.length || referenceDraft.prepared));
    const referenceBox = root.querySelector('[data-existing-reference]');
    referenceBox.hidden = !referenceAvailable;
    if (referenceAvailable) {
      const parts = [];
      if (referenceDraft.referenceTypes?.length) parts.push(referenceDraft.referenceTypes.join(', '));
      if (referenceDraft.fileCount) parts.push(`${referenceDraft.fileCount} selected file${referenceDraft.fileCount === 1 ? '' : 's'}`);
      root.querySelector('[data-existing-reference-copy]').textContent = parts.join(' · ') || 'A prepared reference review draft is available.';
    }
  };

  const updateProgress = () => {
    const position = state.view === 'summary' ? 6 : state.activeStep + 1;
    root.querySelector('[data-troubleshooting-progress-label]').textContent = state.view === 'summary' ? 'Step 6 of 6' : `Step ${position} of 6`;
    root.querySelector('[data-troubleshooting-progress-name]').textContent = steps[position - 1];
    const progress = root.querySelector('[role="progressbar"]');
    progress.setAttribute('aria-valuenow', String(position));
    progress.setAttribute('aria-valuetext', `Step ${position} of 6: ${steps[position - 1]}`);
    root.querySelector('[data-troubleshooting-progress-fill]').style.width = `${(position / 6) * 100}%`;
    root.querySelectorAll('[data-troubleshooting-step-target]').forEach((button, index) => {
      const available = index <= state.highestStep || state.view === 'summary';
      const current = index === position - 1;
      button.disabled = !available;
      button.classList.toggle('is-complete', index < position - 1 || state.view === 'summary');
      if (current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  };

  const focusCurrentHeading = () => {
    const target = state.view === 'summary'
      ? root.querySelector('#zlh-technical-brief-title')
      : root.querySelector(`[data-troubleshooting-step="${state.activeStep}"] h3`);
    window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  };

  const renderStep = (moveFocus = false) => {
    state.view = 'steps';
    form.hidden = false;
    summary.hidden = true;
    root.querySelectorAll('[data-troubleshooting-step]').forEach((section, index) => { section.hidden = index !== state.activeStep; });
    root.querySelector('[data-troubleshooting-previous]').hidden = state.activeStep === 0;
    root.querySelector('[data-troubleshooting-next]').textContent = state.activeStep === 4 ? 'Review Technical Brief →' : 'Continue →';
    error.hidden = true;
    error.textContent = '';
    hydrate();
    refreshAvailability();
    updateProgress();
    saveState();
    live.textContent = `Step ${state.activeStep + 1} of 6: ${steps[state.activeStep]}`;
    if (moveFocus) focusCurrentHeading();
  };

  const showError = (message, control) => {
    error.textContent = message;
    error.hidden = false;
    control?.setAttribute('aria-invalid', 'true');
    control?.setAttribute('aria-describedby', 'zlh-troubleshooting-error');
    control?.focus();
    return false;
  };

  const validateStep = () => {
    root.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute('aria-invalid'));
    if (state.activeStep === 0 && !state.data.category) return showError('Choose the primary area that needs review.', form.elements.category[0]);
    if (state.activeStep === 0 && state.data.category === 'Other' && !state.data.categoryOther.trim()) return showError('Describe the area that needs review.', form.elements.categoryOther);
    if (state.activeStep === 1 && !state.data.observation) return showError('Choose the closest current observation.', form.elements.observation?.[0]);
    if (state.activeStep === 1 && state.data.observation === 'Other' && !state.data.observationOther.trim()) return showError('Describe what you are observing.', form.elements.observationOther);
    if (state.activeStep === 2 && !state.data.desiredResult) return showError('Choose the closest desired result.', form.elements.desiredResult[0]);
    if (state.activeStep === 3 && !state.data.knownFields.length) return showError('Select the technical information available, or choose None / Not Sure.', form.elements.knownField[0]);
    if (state.activeStep === 4 && !state.data.reference) return showError('Choose the reference information currently available.', form.elements.reference[0]);
    return true;
  };

  const addRow = (list, termText, valueText) => {
    if (!valueText) return;
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.textContent = termText;
    value.textContent = valueText;
    list.append(term, value);
  };

  const addSummarySection = (container, title, rows) => {
    const populated = rows.filter(([, value]) => Boolean(value));
    if (!populated.length) return;
    const section = document.createElement('section');
    const heading = document.createElement('h4');
    const list = document.createElement('dl');
    heading.textContent = title;
    populated.forEach(([term, value]) => addRow(list, term, value));
    section.append(heading, list);
    container.append(section);
  };

  const reviewValue = (field, category) => {
    if (state.data.knownFields.includes(field)) return state.data[`known${field.charAt(0).toUpperCase()}${field.slice(1)}`] || 'Technical Review Required';
    return state.data.category === category ? 'Technical Review Required' : '';
  };

  const renderSummary = (moveFocus = false) => {
    state.view = 'summary';
    state.activeStep = 5;
    state.highestStep = 5;
    form.hidden = true;
    summary.hidden = false;
    const container = root.querySelector('[data-troubleshooting-summary-sections]');
    container.replaceChildren();
    const observation = state.data.observation === 'Other' ? state.data.observationOther : state.data.observation;
    addSummarySection(container, 'Buyer Observation', [
      ['Problem Area', state.data.category === 'Other' ? state.data.categoryOther : state.data.category],
      ['Current Observation', observation],
      ['Observation Detail', state.data.observation !== 'Other' ? state.data.observationOther : ''],
      ['Requirement Stage', state.data.requirementStage],
      ['Production Observation', state.data.productionNote],
      ['Trial / Production Context', state.data.breakageStage],
      ['Physical Yarn Sample', state.data.breakageSample],
      ['Existing Technical Specification', state.data.breakageSpecification]
    ]);
    addSummarySection(container, 'Desired Result', [
      ['Desired Result', state.data.desiredResult],
      ['Additional Note', state.data.desiredNote]
    ]);
    const colourFinish = [state.data.knownColour, state.data.knownFinish].filter(Boolean).join(' / ');
    addSummarySection(container, 'Known Technical Information', [
      ['Application', state.data.knownApplication || state.data.breakageApplication],
      ['Yarn Type', state.data.knownYarnType],
      ['Colour / Finish', colourFinish],
      ['Denier', reviewValue('denier', 'Denier Concern')],
      ['TPM', reviewValue('tpm', 'TPM Concern')],
      ['Twist', reviewValue('twist', 'Twist Concern')],
      ['Construction', reviewValue('construction', 'Construction Concern')],
      ['Quantity', state.data.knownQuantity],
      ['Existing Specification', state.data.knownSpecification],
      ['Technical Information Review', state.data.knownFields.includes('none') || state.data.category === 'Not Sure' ? 'Technical Review Required' : '']
    ]);
    addSummarySection(container, 'Reference', [
      ['Reference Available', state.data.reference],
      ['Existing Reference Draft', state.data.useReferenceDraft ? (state.data.referenceDraftLabel || 'Included by reference') : '']
    ]);

    const hasUsableReference = !['No Reference', 'Not Sure', ''].includes(state.data.reference) || state.data.useReferenceDraft;
    let nextAction = hasUsableReference
      ? 'Next step: Prepare your reference details.'
      : 'Next step: Consider preparing a yarn, fabric or specification reference for technical review.';
    if (state.data.desiredResult === 'Develop a new sample') nextAction = 'Next step: Request a sample.';
    if (state.data.knownQuantity && state.data.requirementStage === 'Production Discussion') nextAction = 'Next step: Continue to RFQ with the available commercial requirement.';
    root.querySelector('[data-next-action]').textContent = nextAction;
    updateProgress();
    saveState();
    live.textContent = 'Technical Review Brief ready.';
    if (moveFocus) focusCurrentHeading();
  };

  const importConfigurator = () => {
    const data = getConfigurator();
    if (!hasConfiguratorData(data)) return false;
    const apply = (field, value, knownField) => {
      if (typeof value !== 'string' || !value.trim()) return;
      state.data[field] = value.trim();
      if (knownField) selectKnownField(knownField);
    };
    apply('knownApplication', data.application === 'Other / Not Sure' && data.applicationOther ? data.applicationOther : data.application, 'application');
    apply('knownYarnType', data.yarnType, 'yarnType');
    apply('knownColour', data.colour, 'colourFinish');
    apply('knownFinish', data.finish, 'colourFinish');
    if (data.colourCustom) state.data.knownColour = [state.data.knownColour, data.colourCustom].filter(Boolean).join(' - ');
    if (data.denierKnown === 'yes') apply('knownDenier', data.denier, 'denier');
    else if (data.denierKnown === 'no') selectKnownField('denier');
    if (data.tpmKnown === 'yes') apply('knownTpm', data.tpm, 'tpm');
    else if (data.tpmKnown === 'no') selectKnownField('tpm');
    apply('knownTwist', data.twist, 'twist');
    if (data.constructionKnown === 'yes') apply('knownConstruction', data.construction, 'construction');
    else if (data.constructionKnown === 'no') selectKnownField('construction');
    apply('knownQuantity', data.quantity, 'quantity');
    state.data.usedConfigurator = true;
    hydrate();
    saveState();
    root.querySelector('[data-import-feedback]').textContent = 'Build Your Zari information added here. Your original requirement was not changed.';
    return true;
  };

  const importLabRequirement = type => {
    const eventMap = {
      colour: 'suvarnatantu:zari-colour-lab-state-query', twist: 'suvarnatantu:zari-twist-lab-state-query',
      tpm: 'suvarnatantu:zari-tpm-lab-state-query', denier: 'suvarnatantu:zari-denier-lab-state-query',
      construction: 'suvarnatantu:zari-construction-lab-state-query'
    };
    const lab = query(eventMap[type]);
    const config = getConfigurator() || {};
    let imported = false;
    if (type === 'colour') {
      const source = lab?.colour && lab?.finish ? lab : config;
      if (source.colour || source.finish) {
        state.data.knownColour = [source.colour, source.colourCustom || source.note].filter(Boolean).join(' - ');
        state.data.knownFinish = source.finish || '';
        selectKnownField('colourFinish'); imported = true;
      }
    } else if (type === 'twist') {
      const value = lab?.twist || config.twist;
      if (value) { state.data.knownTwist = value; selectKnownField('twist'); imported = true; }
    } else if (type === 'tpm') {
      const source = lab?.tpmKnown ? lab : config;
      if (source.tpmKnown) { state.data.knownTpm = source.tpmKnown === 'yes' ? source.tpm : ''; selectKnownField('tpm'); imported = true; }
    } else if (type === 'denier') {
      const source = lab?.denierKnown ? lab : config;
      if (source.denierKnown) { state.data.knownDenier = source.denierKnown === 'yes' ? source.denier : ''; selectKnownField('denier'); imported = true; }
    } else if (type === 'construction') {
      const source = lab?.constructionKnown ? lab : config;
      if (source.constructionKnown) { state.data.knownConstruction = source.constructionKnown === 'yes' ? source.construction : ''; selectKnownField('construction'); imported = true; }
    }
    if (imported) {
      hydrate(); saveState();
      root.querySelector('[data-import-feedback]').textContent = `${type.charAt(0).toUpperCase()}${type.slice(1)} requirement copied. Only an explicit buyer selection was used.`;
    } else root.querySelector('[data-import-feedback]').textContent = `No explicit ${type} requirement is currently available.`;
  };

  form.addEventListener('input', event => {
    const control = event.target;
    if (!control.name || control.type === 'radio' || control.type === 'checkbox') return;
    if (!Object.prototype.hasOwnProperty.call(state.data, control.name)) return;
    state.data[control.name] = cleanText(control.value, textLimits[control.name] || 120);
    control.removeAttribute('aria-invalid');
    error.hidden = true;
    updateConditionals();
    saveState();
  });

  form.addEventListener('change', event => {
    const control = event.target;
    if (control.name === 'knownField') {
      if (control.value === 'none' && control.checked) state.data.knownFields = ['none'];
      else if (control.checked) {
        state.data.knownFields = state.data.knownFields.filter(value => value !== 'none');
        if (!state.data.knownFields.includes(control.value)) state.data.knownFields.push(control.value);
      } else state.data.knownFields = state.data.knownFields.filter(value => value !== control.value);
      hydrate(); saveState(); return;
    }
    if (!control.name || !Object.prototype.hasOwnProperty.call(state.data, control.name)) return;
    const previousCategory = state.data.category;
    state.data[control.name] = cleanText(control.value, textLimits[control.name] || 120);
    if (control.name === 'category' && previousCategory !== control.value) {
      state.data.observation = '';
      state.data.observationOther = '';
      if (control.value === 'Yarn Type / Product Selection') selectKnownField('yarnType');
      renderObservationOptions();
    }
    control.removeAttribute('aria-invalid');
    error.hidden = true;
    updateConditionals();
    saveState();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!validateStep()) return;
    if (state.activeStep === 4) { renderSummary(true); return; }
    state.activeStep += 1;
    state.highestStep = Math.max(state.highestStep, state.activeStep);
    renderStep(true);
  });

  root.addEventListener('click', event => {
    const previous = event.target.closest('[data-troubleshooting-previous]');
    if (previous) { state.activeStep = Math.max(0, state.activeStep - 1); renderStep(true); return; }
    const stepButton = event.target.closest('[data-troubleshooting-step-target]');
    if (stepButton && !stepButton.disabled) {
      const target = Number(stepButton.dataset.troubleshootingStepTarget);
      if (target === 5 && state.highestStep === 5) renderSummary(true);
      else { state.activeStep = Math.min(4, target); renderStep(true); }
      return;
    }
    if (event.target.closest('[data-use-configurator]')) { importConfigurator(); return; }
    const labButton = event.target.closest('[data-use-colour], [data-use-twist], [data-use-tpm], [data-use-denier], [data-use-construction]');
    if (labButton) {
      const type = ['colour', 'twist', 'tpm', 'denier', 'construction'].find(name => labButton.hasAttribute(`data-use-${name}`));
      importLabRequirement(type); return;
    }
    if (event.target.closest('[data-use-reference-draft]')) {
      const draft = query('suvarnatantu:zari-reference-query');
      if (draft) {
        const parts = [];
        if (draft.referenceTypes?.length) parts.push(draft.referenceTypes.join(', '));
        if (draft.fileCount) parts.push(`${draft.fileCount} selected file${draft.fileCount === 1 ? '' : 's'}`);
        state.data.useReferenceDraft = true;
        state.data.referenceDraftLabel = parts.join(' · ') || 'Prepared reference review draft';
        if (!state.data.reference && draft.referenceTypes?.[0]) {
          const mapped = draft.referenceTypes[0] === 'Physical Sample Available' ? 'Physical Yarn Sample' : draft.referenceTypes[0];
          if (references.includes(mapped)) state.data.reference = mapped;
        }
        hydrate(); saveState();
        root.querySelector('[data-existing-reference-copy]').textContent = 'Existing reference draft linked to this troubleshooting brief.';
      }
      return;
    }
    if (event.target.closest('[data-edit-troubleshooting]')) { state.activeStep = 0; renderStep(true); return; }
    if (event.target.closest('[data-reset-troubleshooting]')) {
      lastFocusedElement = event.target;
      confirmation.hidden = false;
      document.body.classList.add('zlh-confirmation-open');
      confirmation.querySelector('[data-troubleshooting-reset-cancel]').focus();
      return;
    }
    if (event.target.closest('[data-troubleshooting-reset-cancel]')) {
      confirmation.hidden = true; document.body.classList.remove('zlh-confirmation-open'); lastFocusedElement?.focus(); return;
    }
    if (event.target.closest('[data-troubleshooting-reset-confirm]')) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_error) { /* Continue with in-memory reset. */ }
      state = freshState();
      confirmation.hidden = true;
      document.body.classList.remove('zlh-confirmation-open');
      renderStep(true);
    }
  });

  confirmation.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      confirmation.hidden = true; document.body.classList.remove('zlh-confirmation-open'); lastFocusedElement?.focus(); return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(confirmation.querySelectorAll('button:not([disabled])'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  ['suvarnatantu:zari-requirement-updated', 'suvarnatantu:zari-reference-updated'].forEach(eventName => {
    document.addEventListener(eventName, () => { if (state.view === 'steps') refreshAvailability(); });
  });

  document.addEventListener('suvarnatantu:zari-troubleshooting-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({
      view: state.view,
      data: { ...state.data, knownFields: [...state.data.knownFields] }
    });
  });

  if (state.view === 'summary') renderSummary();
  else renderStep();
})();
