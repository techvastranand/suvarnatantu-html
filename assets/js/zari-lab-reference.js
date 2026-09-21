(() => {
  'use strict';

  const root = document.querySelector('[data-reference-review]');
  if (!root || root.dataset.referenceReady === 'true') return;
  root.dataset.referenceReady = 'true';

  const form = root.querySelector('[data-reference-form]');
  const fileInput = root.querySelector('#zlh-reference-files');
  const uploadZone = root.querySelector('[data-upload-zone]');
  const fileList = root.querySelector('[data-file-list]');
  const uploadError = root.querySelector('[data-upload-error]');
  const description = root.querySelector('[name="description"]');
  const descriptionCount = root.querySelector('[data-description-count]');
  const physicalNote = root.querySelector('[data-physical-sample-note]');
  const includeConfigurator = root.querySelector('[data-include-configurator]');
  const configAvailability = root.querySelector('[data-config-availability]');
  const configSummary = root.querySelector('[data-config-summary]');
  const handoff = root.querySelector('[data-reference-handoff]');
  const draftMessage = root.querySelector('[data-draft-message]');
  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const supportedFiles = {
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    png: ['image/png'],
    webp: ['image/webp'],
    pdf: ['application/pdf']
  };
  const selectedFiles = [];
  let configuratorData = null;
  let preparedDraft = null;

  const setError = (name, message) => {
    const error = root.querySelector(`[data-error-for="${name}"]`);
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  };

  const setUploadError = message => {
    uploadError.textContent = message;
    uploadError.hidden = !message;
    fileInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  };

  const fileExtension = name => {
    const match = /\.([^.]+)$/.exec(name);
    return match ? match[1].toLowerCase() : '';
  };

  const fileKey = file => `${file.name}\u0000${file.size}\u0000${file.lastModified}`;

  const validateFile = file => {
    const extension = fileExtension(file.name);
    const allowedMimeTypes = supportedFiles[extension];
    if (!allowedMimeTypes || (file.type && !allowedMimeTypes.includes(file.type.toLowerCase()))) {
      return 'This file type is not supported. Please select JPG, PNG, WebP or PDF.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} is larger than 10 MB. Please choose a smaller file.`;
    }
    return '';
  };

  const formatFileSize = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const revokePreview = entry => {
    if (!entry.previewUrl) return;
    URL.revokeObjectURL(entry.previewUrl);
    entry.previewUrl = '';
  };

  const renderFiles = () => {
    fileList.replaceChildren();
    selectedFiles.forEach((entry, index) => {
      const card = document.createElement('article');
      card.className = 'zlh-file-card';

      const preview = document.createElement('div');
      preview.className = 'zlh-file-card__preview';
      if (entry.isImage) {
        const image = document.createElement('img');
        image.src = entry.previewUrl;
        image.alt = `Preview of ${entry.file.name}`;
        preview.append(image);
      } else {
        const documentMark = document.createElement('span');
        documentMark.className = 'zlh-file-card__document';
        documentMark.textContent = 'PDF';
        documentMark.setAttribute('aria-hidden', 'true');
        preview.append(documentMark);
      }

      const details = document.createElement('div');
      details.className = 'zlh-file-card__details';
      const name = document.createElement('strong');
      name.textContent = entry.file.name;
      const size = document.createElement('span');
      size.textContent = formatFileSize(entry.file.size);
      details.append(name, size);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'zlh-file-card__remove';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${entry.file.name}`);
      remove.addEventListener('click', () => {
        revokePreview(entry);
        selectedFiles.splice(index, 1);
        preparedDraft = null;
        handoff.hidden = true;
        setUploadError('');
        renderFiles();
        document.dispatchEvent(new CustomEvent('suvarnatantu:zari-reference-updated'));
        fileInput.focus();
      });

      card.append(preview, details, remove);
      fileList.append(card);
    });
  };

  const addFiles = files => {
    const incoming = Array.from(files || []);
    setUploadError('');
    if (!incoming.length) return;
    if (selectedFiles.length + incoming.length > MAX_FILES) {
      setUploadError(`You can select up to ${MAX_FILES} files. Remove a file before adding another.`);
      return;
    }

    const errors = [];
    incoming.forEach(file => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
        return;
      }
      if (selectedFiles.some(entry => entry.key === fileKey(file))) {
        errors.push(`${file.name} is already selected.`);
        return;
      }
      const isImage = fileExtension(file.name) !== 'pdf';
      selectedFiles.push({
        file,
        key: fileKey(file),
        isImage,
        previewUrl: isImage ? URL.createObjectURL(file) : ''
      });
    });
    preparedDraft = null;
    handoff.hidden = true;
    renderFiles();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-reference-updated'));
    if (errors.length) setUploadError(errors.join(' '));
  };

  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(type => uploadZone.addEventListener(type, event => {
    event.preventDefault();
    event.stopPropagation();
    uploadZone.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach(type => uploadZone.addEventListener(type, event => {
    event.preventDefault();
    event.stopPropagation();
    uploadZone.classList.remove('is-dragover');
  }));
  uploadZone.addEventListener('drop', event => addFiles(event.dataTransfer?.files));

  const getConfiguratorData = () => {
    let response = null;
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-requirement-query', {
      detail: { respond: data => { response = data && typeof data === 'object' ? data : null; } }
    }));
    return response;
  };

  const configuratorRows = data => {
    if (!data) return [];
    const application = data.application === 'Other / Not Sure' && data.applicationOther
      ? `${data.application} — ${data.applicationOther}` : data.application;
    const construction = data.constructionKnown === 'no' ? 'Technical Review Required' : data.construction;
    const referenceNotes = [data.reference, data.notes, data.constructionNotes].filter(Boolean).join(' — ');
    return [
      ['Application', application],
      ['Yarn Type', data.yarnType],
      ['Colour', data.colourCustom ? `${data.colour || 'Custom'} — ${data.colourCustom}` : data.colour],
      ['Finish', data.finish],
      ['Denier', data.denierKnown === 'no' ? 'Technical Review Required' : data.denier],
      ['TPM', data.tpmKnown === 'no' ? 'Technical Review Required' : data.tpm],
      ['Twist', data.twist],
      ['Construction', construction],
      ['Quantity', data.quantity],
      ['Reference Notes', referenceNotes]
    ].filter(([, value]) => typeof value === 'string' && value.trim());
  };

  const renderConfiguratorSummary = () => {
    configSummary.replaceChildren();
    if (!includeConfigurator.checked || !configuratorData) {
      configSummary.hidden = true;
      return;
    }
    configuratorRows(configuratorData).forEach(([label, value]) => {
      const item = document.createElement('div');
      const term = document.createElement('dt');
      const descriptionValue = document.createElement('dd');
      term.textContent = label;
      descriptionValue.textContent = value;
      item.append(term, descriptionValue);
      configSummary.append(item);
    });
    configSummary.hidden = !configSummary.childElementCount;
  };

  const refreshConfigurator = () => {
    const data = getConfiguratorData();
    const rows = configuratorRows(data);
    configuratorData = rows.length ? data : null;
    if (configuratorData) {
      const application = form.elements.application;
      const yarnType = form.elements.yarnType;
      const mappedYarnType = configuratorData.yarnType === 'Not Sure — Need Technical Review'
        ? 'Not Sure' : configuratorData.yarnType;
      if (!application.value && Array.from(application.options).some(option => option.value === configuratorData.application)) {
        application.value = configuratorData.application;
      }
      if (!yarnType.value && Array.from(yarnType.options).some(option => option.value === mappedYarnType)) {
        yarnType.value = mappedYarnType;
      }
    }
    includeConfigurator.disabled = !configuratorData;
    if (!configuratorData) includeConfigurator.checked = false;
    configAvailability.textContent = configuratorData
      ? 'Your current requirement is available. Select it to preview the included details.'
      : 'No Build Your Zari requirement is currently available.';
    renderConfiguratorSummary();
  };

  includeConfigurator.addEventListener('pointerdown', refreshConfigurator);
  includeConfigurator.addEventListener('focus', refreshConfigurator);
  includeConfigurator.addEventListener('change', () => {
    preparedDraft = null;
    handoff.hidden = true;
    renderConfiguratorSummary();
  });
  ['colour', 'twist', 'tpm', 'denier', 'construction'].forEach(lab => {
    document.addEventListener(`suvarnatantu:zari-${lab}-applied`, refreshConfigurator);
  });
  document.addEventListener('suvarnatantu:zari-requirement-updated', refreshConfigurator);

  description.addEventListener('input', () => {
    descriptionCount.textContent = String(description.value.length);
  });

  form.addEventListener('change', event => {
    preparedDraft = null;
    handoff.hidden = true;
    if (event.target.name === 'physicalSample') physicalNote.hidden = event.target.value !== 'Yes';
    if (event.target.name === 'referenceType') document.dispatchEvent(new CustomEvent('suvarnatantu:zari-reference-updated'));
    if (event.target.name) setError(event.target.name, '');
  });
  form.addEventListener('input', event => {
    preparedDraft = null;
    handoff.hidden = true;
    if (event.target.name) setError(event.target.name, '');
  });

  const checkedValues = name => Array.from(form.querySelectorAll(`[name="${name}"]:checked`), control => control.value);

  const showValidationError = (name, message, control) => {
    setError(name, message);
    control?.setAttribute('aria-invalid', 'true');
    return control;
  };

  const validateForm = () => {
    root.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute('aria-invalid'));
    root.querySelectorAll('[data-error-for]').forEach(error => { error.hidden = true; error.textContent = ''; });
    setUploadError('');
    let firstInvalid = null;
    const mark = (name, message, control) => {
      const invalid = showValidationError(name, message, control);
      if (!firstInvalid) firstInvalid = invalid;
    };

    const referenceTypes = checkedValues('referenceType');
    if (!referenceTypes.length) mark('referenceType', 'Select at least one reference type.', form.elements.referenceType[0]);
    const needsFile = referenceTypes.some(type => type !== 'Physical Sample Available');
    if (needsFile && !selectedFiles.length) {
      setUploadError('Add at least one supported reference file for the selected reference type.');
      if (!firstInvalid) firstInvalid = fileInput;
    }
    if (!form.elements.application.value) mark('application', 'Select the intended application.', form.elements.application);
    if (!form.elements.yarnType.value) mark('yarnType', 'Select a product or yarn type.', form.elements.yarnType);
    if (!checkedValues('reviewArea').length) mark('reviewArea', 'Select at least one area for technical review.', form.elements.reviewArea[0]);
    if (!description.value.trim()) mark('description', 'Describe what you want to achieve.', description);
    if (!form.elements.physicalSample.value) mark('physicalSample', 'Choose whether a physical sample is available.', form.elements.physicalSample[0]);

    ['fullName', 'company', 'email', 'country'].forEach(name => {
      const control = form.elements[name];
      if (!control.value.trim()) mark(name, 'This field is required.', control);
    });
    if (form.elements.email.value && !form.elements.email.validity.valid) {
      mark('email', 'Enter a valid business email address.', form.elements.email);
    }
    if (form.elements.website.value && !form.elements.website.validity.valid) {
      mark('website', 'Enter a complete website address, including https://.', form.elements.website);
    }
    if (!form.elements.consent.checked) mark('consent', 'Confirm that you are authorised to share these materials.', form.elements.consent);

    if (firstInvalid) {
      draftMessage.textContent = 'Please review the highlighted fields. Your selected files are still available.';
      draftMessage.hidden = false;
      firstInvalid.focus();
      return false;
    }
    setUploadError('');
    draftMessage.hidden = true;
    return true;
  };

  const buildDraft = () => ({
    status: 'Reference Draft',
    referenceTypes: checkedValues('referenceType'),
    files: selectedFiles.map(({ file }) => ({
      name: file.name,
      size: file.size,
      type: file.type || 'Not provided',
      lastModified: file.lastModified
    })),
    context: {
      application: form.elements.application.value,
      yarnType: form.elements.yarnType.value,
      reviewAreas: checkedValues('reviewArea'),
      description: description.value.trim(),
      issue: form.elements.issue.value,
      physicalSample: form.elements.physicalSample.value
    },
    buyer: {
      fullName: form.elements.fullName.value.trim(),
      company: form.elements.company.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      country: form.elements.country.value.trim(),
      city: form.elements.city.value.trim(),
      website: form.elements.website.value.trim()
    },
    configurator: includeConfigurator.checked ? Object.fromEntries(configuratorRows(configuratorData)) : null
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!validateForm()) return;
    preparedDraft = buildDraft();
    handoff.hidden = false;
    draftMessage.textContent = 'Reference details prepared. Selected files have not been transmitted from this page.';
    draftMessage.hidden = false;
    handoff.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    handoff.querySelector('a')?.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-reference-updated'));
  });

  document.addEventListener('suvarnatantu:zari-reference-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({
      referenceTypes: checkedValues('referenceType'),
      fileCount: selectedFiles.length,
      files: selectedFiles.map(({ file }) => ({
        name: file.name,
        size: file.size,
        type: file.type || 'Not provided'
      })),
      prepared: Boolean(preparedDraft),
      context: {
        reviewAreas: checkedValues('reviewArea'),
        description: description.value.trim(),
        issue: form.elements.issue.value,
        physicalSample: form.elements.physicalSample.value
      }
    });
  });

  window.addEventListener('pagehide', () => selectedFiles.forEach(revokePreview), { once: true });
  refreshConfigurator();
})();
