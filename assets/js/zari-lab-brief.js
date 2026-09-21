(() => {
  'use strict';

  const root = document.querySelector('[data-requirement-brief]');
  if (!root || root.dataset.briefReady === 'true') return;
  root.dataset.briefReady = 'true';

  const documentPanel = root.querySelector('[data-brief-document]');
  const emptyState = root.querySelector('[data-brief-empty]');
  const printButton = root.querySelector('[data-print-brief]');
  const refreshButton = root.querySelector('[data-refresh-brief]');
  const feedback = root.querySelector('[data-brief-feedback]');
  const sectionContainer = root.querySelector('[data-brief-sections]');
  const reviewPanel = root.querySelector('[data-brief-review-panel]');
  const reviewList = root.querySelector('[data-brief-review-list]');
  const conflictPanel = root.querySelector('[data-brief-conflicts]');
  const conflictList = root.querySelector('[data-brief-conflict-list]');
  const filesSection = root.querySelector('[data-brief-files-section]');
  const filesList = root.querySelector('[data-brief-files]');

  const query = eventName => {
    let response = null;
    document.dispatchEvent(new CustomEvent(eventName, {
      detail: { respond: value => { if (value && typeof value === 'object') response = value; } }
    }));
    return response || {};
  };

  const text = value => typeof value === 'string' ? value.trim() : '';
  const isReviewValue = value => /not sure|review required|technical review required/i.test(text(value));
  const sameValue = (first, second) => text(first).toLocaleLowerCase() === text(second).toLocaleLowerCase();
  const field = (label, value, source, editHref, options = {}) => {
    const normalized = text(value);
    if (!normalized) return null;
    const review = options.review === true || isReviewValue(normalized);
    return {
      label,
      value: review && !isReviewValue(normalized) ? 'Technical Review Required' : normalized,
      status: review ? 'Not yet confirmed' : 'Buyer-provided',
      source,
      editHref,
      review
    };
  };
  const reviewField = (label, source, editHref) => field(label, 'Technical Review Required', source, editHref, { review: true });
  const firstField = (...candidates) => candidates.find(Boolean) || null;

  const knownOrReview = ({ label, configuredKnown, configuredValue, labKnown, labValue, troubleValue, labSource, editHref }) => {
    if (configuredKnown === 'yes' && text(configuredValue)) return field(label, configuredValue, 'Build Your Zari', editHref);
    if (configuredKnown === 'no') return reviewField(label, 'Build Your Zari', editHref);
    if (labKnown === 'yes' && text(labValue)) return field(label, labValue, labSource, editHref);
    if (labKnown === 'no') return reviewField(label, labSource, editHref);
    if (text(troubleValue)) return field(label, troubleValue, 'Troubleshooting', editHref);
    return null;
  };

  const addConflict = (conflicts, label, configured, labValue, labName, href) => {
    if (!text(configured) || !text(labValue) || isReviewValue(configured) || isReviewValue(labValue) || sameValue(configured, labValue)) return;
    conflicts.push({
      label,
      message: `A different ${label} selection exists in ${labName}. Build Your Zari remains the source of truth for this brief.`,
      href
    });
  };

  const normalize = () => {
    const config = query('suvarnatantu:zari-requirement-query');
    const colourLab = query('suvarnatantu:zari-colour-lab-state-query');
    const twistLab = query('suvarnatantu:zari-twist-lab-state-query');
    const tpmLab = query('suvarnatantu:zari-tpm-lab-state-query');
    const denierLab = query('suvarnatantu:zari-denier-lab-state-query');
    const constructionLab = query('suvarnatantu:zari-construction-lab-state-query');
    const reference = query('suvarnatantu:zari-reference-query');
    const troubleshootingResponse = query('suvarnatantu:zari-troubleshooting-query');
    const trouble = troubleshootingResponse.data && typeof troubleshootingResponse.data === 'object' ? troubleshootingResponse.data : {};

    const application = firstField(
      field('Application', config.application === 'Other / Not Sure' && text(config.applicationOther) ? config.applicationOther : config.application, 'Build Your Zari', '#build-your-zari'),
      field('Application', trouble.knownApplication || trouble.breakageApplication, 'Troubleshooting', '#troubleshooting-lab')
    );
    const yarnType = firstField(
      field('Yarn Type', config.yarnType, 'Build Your Zari', '#build-your-zari'),
      field('Yarn Type', trouble.knownYarnType, 'Troubleshooting', '#troubleshooting-lab')
    );
    const requirementStage = firstField(
      field('Requirement Stage', config.requirementStage, 'Build Your Zari', '#build-your-zari'),
      field('Requirement Stage', trouble.requirementStage, 'Troubleshooting', '#troubleshooting-lab')
    );
    const quantity = firstField(
      field('Approximate Quantity', config.quantity, 'Build Your Zari', '#build-your-zari'),
      field('Approximate Quantity', trouble.knownQuantity, 'Troubleshooting', '#troubleshooting-lab')
    );

    const colour = firstField(
      field('Colour', config.colour, 'Build Your Zari', '#colour-finish-lab'),
      field('Colour', colourLab.colour, 'Colour Lab', '#colour-finish-lab'),
      field('Colour', trouble.knownColour, 'Troubleshooting', '#troubleshooting-lab')
    );
    const finish = firstField(
      field('Finish', config.finish, 'Build Your Zari', '#colour-finish-lab'),
      field('Finish', colourLab.finish, 'Colour Lab', '#colour-finish-lab'),
      field('Finish', trouble.knownFinish, 'Troubleshooting', '#troubleshooting-lab')
    );
    const colourNote = firstField(
      field('Custom Colour / Finish Note', config.colourCustom, 'Build Your Zari', '#colour-finish-lab'),
      field('Custom Colour / Finish Note', colourLab.note, 'Colour Lab', '#colour-finish-lab')
    );

    const denier = knownOrReview({
      label: 'Denier', configuredKnown: config.denierKnown, configuredValue: config.denier,
      labKnown: denierLab.denierKnown, labValue: denierLab.denier, troubleValue: trouble.knownDenier,
      labSource: 'Denier Explorer', editHref: '#denier-explorer'
    });
    const tpm = knownOrReview({
      label: 'TPM', configuredKnown: config.tpmKnown, configuredValue: config.tpm,
      labKnown: tpmLab.tpmKnown, labValue: tpmLab.tpm, troubleValue: trouble.knownTpm,
      labSource: 'TPM Explorer', editHref: '#tpm-explorer'
    });
    const twist = firstField(
      field('Twist', config.twist, 'Build Your Zari', '#twist-lab'),
      field('Twist', twistLab.twist, 'Twist Lab', '#twist-lab'),
      field('Twist', trouble.knownTwist, 'Troubleshooting', '#troubleshooting-lab')
    );
    const construction = knownOrReview({
      label: 'Construction', configuredKnown: config.constructionKnown, configuredValue: config.construction,
      labKnown: constructionLab.constructionKnown, labValue: constructionLab.construction,
      troubleValue: trouble.knownConstruction, labSource: 'Construction Explorer', editHref: '#construction-explorer'
    });

    const referenceTypes = Array.isArray(reference.referenceTypes) ? reference.referenceTypes.map(text).filter(Boolean) : [];
    const files = Array.isArray(reference.files) ? reference.files.filter(item => item && text(item.name)).map(item => ({
      name: text(item.name).slice(0, 240), type: text(item.type).slice(0, 120) || 'Not provided',
      size: Number.isFinite(item.size) && item.size >= 0 ? item.size : 0
    })) : [];
    const referenceType = firstField(
      field('Reference Type', config.reference, 'Build Your Zari', '#reference-review'),
      referenceTypes.length ? field('Reference Type', referenceTypes.join(', '), 'Reference Review', '#reference-review') : null,
      field('Reference Type', trouble.reference, 'Troubleshooting', '#troubleshooting-lab')
    );
    const referenceContext = reference.context && typeof reference.context === 'object' ? reference.context : {};
    const physicalSample = firstField(
      field('Physical Sample Availability', referenceContext.physicalSample, 'Reference Review', '#reference-review'),
      field('Physical Sample Availability', /Physical Yarn Sample|Fabric Sample/.test(text(trouble.reference)) ? 'Available' : trouble.breakageSample, 'Troubleshooting', '#troubleshooting-lab')
    );
    const existingSpecification = firstField(
      field('Existing Specification Available', trouble.breakageSpecification, 'Troubleshooting', '#troubleshooting-lab'),
      field('Existing Specification Available', text(trouble.knownSpecification) || referenceTypes.includes('Specification Sheet') ? 'Yes' : '', referenceTypes.includes('Specification Sheet') ? 'Reference Review' : 'Troubleshooting', '#reference-review')
    );

    const observation = trouble.observation === 'Other' ? trouble.observationOther : trouble.observation;
    const problemArea = trouble.category === 'Other' ? trouble.categoryOther : trouble.category;
    const knownContext = Array.isArray(trouble.knownFields)
      ? trouble.knownFields.filter(value => value !== 'none').map(value => ({
        yarnType: 'Yarn Type', colourFinish: 'Colour / Finish', denier: 'Denier', tpm: 'TPM', twist: 'Twist',
        construction: 'Construction', application: 'Application', quantity: 'Quantity', existingSpecification: 'Existing Specification'
      }[value] || value)).join(', ')
      : '';
    const troubleshootingRows = [
      field('Problem Area', problemArea, 'Troubleshooting', '#troubleshooting-lab'),
      field('Current Observation', observation, 'Troubleshooting', '#troubleshooting-lab'),
      field('Desired Result', trouble.desiredResult, 'Troubleshooting', '#troubleshooting-lab'),
      field('Requirement Stage', trouble.requirementStage, 'Troubleshooting', '#troubleshooting-lab'),
      field('Known Technical Context', knownContext || (trouble.knownFields?.includes('none') ? 'None / Not Sure' : ''), 'Troubleshooting', '#troubleshooting-lab'),
      field('Reference Availability', trouble.reference, 'Troubleshooting', '#troubleshooting-lab'),
      field('Additional Note', trouble.desiredNote || trouble.productionNote, 'Troubleshooting', '#troubleshooting-lab')
    ].filter(Boolean);

    const notes = [
      field('Build Your Zari Notes', config.notes, 'Build Your Zari', '#build-your-zari'),
      field('Construction Notes', config.constructionNotes || constructionLab.constructionNotes, config.constructionNotes ? 'Build Your Zari' : 'Construction Explorer', '#construction-explorer'),
      field('Reference Review Note', referenceContext.description, 'Reference Review', '#reference-review'),
      field('Reference Review Issue', referenceContext.issue, 'Reference Review', '#reference-review')
    ].filter(Boolean);

    const conflicts = [];
    addConflict(conflicts, 'Colour', config.colour, colourLab.colour, 'Colour Lab', '#colour-finish-lab');
    addConflict(conflicts, 'Finish', config.finish, colourLab.finish, 'Colour Lab', '#colour-finish-lab');
    addConflict(conflicts, 'Twist', config.twist, twistLab.twist, 'Twist Lab', '#twist-lab');
    if (config.tpmKnown === 'yes' && tpmLab.tpmKnown === 'yes') addConflict(conflicts, 'TPM', config.tpm, tpmLab.tpm, 'TPM Explorer', '#tpm-explorer');
    if (config.denierKnown === 'yes' && denierLab.denierKnown === 'yes') addConflict(conflicts, 'Denier', config.denier, denierLab.denier, 'Denier Explorer', '#denier-explorer');
    if (config.constructionKnown === 'yes' && constructionLab.constructionKnown === 'yes') addConflict(conflicts, 'Construction', config.construction, constructionLab.construction, 'Construction Explorer', '#construction-explorer');

    const sections = [
      { title: 'A. Requirement Overview', rows: [application, yarnType, requirementStage, quantity].filter(Boolean) },
      { title: 'B. Colour & Appearance', rows: [colour, finish, colourNote].filter(Boolean) },
      { title: 'C. Technical Parameters', rows: [denier, tpm, twist, construction].filter(Boolean) },
      { title: 'D. Reference Information', rows: [referenceType, physicalSample, existingSpecification].filter(Boolean) },
      { title: 'E. Technical Review Context', rows: troubleshootingRows },
      { title: 'F. Buyer Notes', rows: notes }
    ].filter(section => section.rows.length);

    const parameterFields = [application, yarnType, requirementStage, quantity, colour, finish, denier, tpm, twist, construction].filter(Boolean);
    const reviewItems = [];
    parameterFields.filter(item => item.review).forEach(item => reviewItems.push({ label: item.label, href: item.editHref }));
    const requestedReview = [
      ['Denier', /denier/i, '#denier-explorer'], ['TPM', /TPM/i, '#tpm-explorer'],
      ['Twist', /twist/i, '#twist-lab'], ['Construction', /construction/i, '#construction-explorer']
    ];
    const reviewRequestText = [problemArea, trouble.desiredResult].map(text).join(' ');
    requestedReview.forEach(([label, pattern, href]) => {
      const existing = parameterFields.find(item => item.label === label);
      if (pattern.test(reviewRequestText) && !existing?.value) reviewItems.push({ label, href });
    });
    const uniqueReviewItems = reviewItems.filter((item, index, list) => list.findIndex(candidate => candidate.label === item.label) === index);
    const hasReference = files.length > 0 || referenceTypes.length > 0 || (referenceType && !/no reference|not sure/i.test(referenceType.value));
    const meaningful = sections.length > 0 || files.length > 0;
    const buyerNotes = [
      text(config.notes), text(config.constructionNotes || constructionLab.constructionNotes),
      text(referenceContext.description), text(referenceContext.issue), text(trouble.desiredNote || trouble.productionNote)
    ].filter(Boolean).join('\n');

    return {
      sections, files, conflicts, reviewItems: uniqueReviewItems, meaningful,
      providedCount: parameterFields.filter(item => !item.review).length,
      referenceStatus: hasReference ? 'Reference available' : 'No reference available',
      requirement: {
        application: application?.value || '', yarnType: yarnType?.value || '',
        requirementStage: requirementStage?.value || '', quantity: quantity?.value || '',
        colour: colour?.value || '', finish: finish?.value || '', colourNote: colourNote?.value || '',
        denier: denier?.value || '', tpm: tpm?.value || '', twist: twist?.value || '',
        construction: construction?.value || '', referenceType: referenceType?.value || '',
        physicalSample: physicalSample?.value || '', existingSpecification: existingSpecification?.value || '',
        reviewRequired: uniqueReviewItems.map(item => item.label),
        troubleshooting: {
          problemArea: text(problemArea), observation: text(observation), desiredResult: text(trouble.desiredResult)
        },
        buyerNotes,
        referenceFiles: files.map(file => ({ ...file }))
      }
    };
  };

  const makeEditLink = (href, label) => {
    const edit = document.createElement('a');
    edit.className = 'zlh-brief-edit';
    edit.href = href;
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit ${label}`);
    return edit;
  };

  const renderSection = sectionData => {
    const section = document.createElement('section');
    section.className = 'zlh-brief-section';
    const heading = document.createElement('h3');
    heading.textContent = sectionData.title;
    const list = document.createElement('dl');
    sectionData.rows.forEach(item => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      const value = document.createElement('strong');
      const status = document.createElement('span');
      const source = document.createElement('small');
      term.textContent = item.label;
      value.textContent = item.value;
      status.textContent = item.status;
      status.className = item.review ? 'is-review' : 'is-known';
      source.textContent = `From ${item.source}`;
      source.className = 'zlh-brief-source';
      description.append(value, status, source);
      row.append(term, description, makeEditLink(item.editHref, item.label));
      list.append(row);
    });
    section.append(heading, list);
    return section;
  };

  const formatSize = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const render = (announce = false) => {
    const brief = normalize();
    root.classList.toggle('is-empty', !brief.meaningful);
    emptyState.hidden = brief.meaningful;
    documentPanel.hidden = !brief.meaningful;
    printButton.disabled = !brief.meaningful;
    root.querySelector('[data-brief-prepared]').textContent = `Prepared: ${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())}`;

    sectionContainer.replaceChildren();
    brief.sections.forEach(section => sectionContainer.append(renderSection(section)));
    root.querySelector('[data-brief-provided-count]').textContent = String(brief.providedCount);
    root.querySelector('[data-brief-review-count]').textContent = String(brief.reviewItems.length);
    root.querySelector('[data-brief-reference-status]').textContent = brief.referenceStatus;

    reviewList.replaceChildren();
    brief.reviewItems.forEach(item => {
      const listItem = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = item.label;
      listItem.append(label, makeEditLink(item.href, item.label));
      reviewList.append(listItem);
    });
    reviewPanel.hidden = !brief.reviewItems.length;

    conflictList.replaceChildren();
    brief.conflicts.forEach(conflict => {
      const listItem = document.createElement('li');
      const message = document.createElement('span');
      message.textContent = conflict.message;
      listItem.append(message, makeEditLink(conflict.href, conflict.label));
      conflictList.append(listItem);
    });
    conflictPanel.hidden = !brief.conflicts.length;

    filesList.replaceChildren();
    brief.files.forEach(file => {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      const details = document.createElement('span');
      name.textContent = file.name;
      details.textContent = `${file.type} · ${formatSize(file.size)}`;
      item.append(name, details);
      filesList.append(item);
    });
    filesSection.hidden = !brief.files.length;

    if (announce) {
      feedback.textContent = brief.meaningful ? 'Requirement brief refreshed with the latest Zari Lab information.' : 'No Zari Lab requirement is currently available.';
    }
  };

  refreshButton.addEventListener('click', () => render(true));
  printButton.addEventListener('click', () => {
    render(false);
    if (!printButton.disabled) window.print();
  });
  window.addEventListener('beforeprint', () => render(false));
  ['suvarnatantu:zari-requirement-updated', 'suvarnatantu:zari-reference-updated', 'suvarnatantu:zari-troubleshooting-updated'].forEach(eventName => {
    document.addEventListener(eventName, () => render(false));
  });
  document.addEventListener('suvarnatantu:zari-brief-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    const brief = normalize();
    event.detail.respond({ meaningful: brief.meaningful, requirement: brief.requirement });
  });

  render(false);
})();
