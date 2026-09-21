(() => {
  'use strict';

  const root = document.querySelector('[data-construction-explorer]');
  if (!root) return;

  const state = {
    constructionKnown: '',
    construction: '',
    constructionNotes: '',
    selectedLayer: 'final',
    view: 'combined'
  };
  const layers = {
    core: {
      title: 'Core / Support Yarn',
      description: 'A central or supporting yarn component may form part of the construction brief.'
    },
    metallic: {
      title: 'Metallic Film / Strip',
      description: 'A metallic film or strip may be identified as one component in a buyer specification.'
    },
    relationship: {
      title: 'Twist / Wrap Relationship',
      description: 'Describes how known components may be combined or arranged in the required structure.'
    },
    final: {
      title: 'Finished Yarn Concept',
      description: 'Brings the known components and arrangement together as a conceptual final structure for technical review.'
    }
  };

  const constructionInput = root.querySelector('[data-construction-input]');
  const notesInput = root.querySelector('[data-construction-notes]');
  const inputsWrap = root.querySelector('[data-construction-inputs]');
  const inputError = root.querySelector('[data-construction-error]');
  const applyButton = root.querySelector('[data-apply-construction]');
  const feedback = root.querySelector('[data-construction-feedback]');
  const visual = root.querySelector('[data-construction-visual]');
  const confirmation = root.querySelector('[data-construction-confirmation]');
  let lastFocusedElement = null;

  const normalizeWhitespace = (value, limit) => String(value || '').slice(0, limit).replace(/\s+/g, ' ').trim();

  const clearFeedback = () => {
    feedback.textContent = '';
    feedback.classList.remove('is-success');
  };

  const clearInputError = () => {
    inputError.hidden = true;
    constructionInput.removeAttribute('aria-invalid');
  };

  const showInputError = (moveFocus = true) => {
    inputError.hidden = false;
    constructionInput.setAttribute('aria-invalid', 'true');
    if (moveFocus) constructionInput.focus();
  };

  const updateCounts = () => {
    root.querySelector('[data-construction-count]').textContent = String(constructionInput.value.length);
    root.querySelector('[data-construction-notes-count]').textContent = String(notesInput.value.length);
  };

  const updateRequirement = () => {
    root.querySelectorAll('[data-construction-known-options] button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.constructionKnown === state.constructionKnown));
    });
    inputsWrap.hidden = state.constructionKnown !== 'yes';
    applyButton.disabled = !state.constructionKnown;

    const construction = normalizeWhitespace(state.construction, 180);
    const notes = normalizeWhitespace(state.constructionNotes, 500);
    const notesRow = root.querySelector('[data-current-construction-notes-row]');
    notesRow.hidden = !(state.constructionKnown === 'yes' && notes);
    root.querySelector('[data-current-construction-notes]').textContent = notes;

    if (state.constructionKnown === 'yes' && construction) {
      root.querySelector('[data-current-construction]').textContent = construction;
      root.querySelector('[data-current-construction-status]').textContent = 'Buyer-provided information';
      root.querySelector('[data-construction-readiness]').textContent = 'Ready to use';
    } else if (state.constructionKnown === 'yes') {
      root.querySelector('[data-current-construction]').textContent = 'Awaiting details';
      root.querySelector('[data-current-construction-status]').textContent = 'Construction details required';
      root.querySelector('[data-construction-readiness]').textContent = 'Details required';
    } else if (state.constructionKnown === 'no') {
      root.querySelector('[data-current-construction]').textContent = 'Technical Review Required';
      root.querySelector('[data-current-construction-status]').textContent = 'Technical Review Required';
      root.querySelector('[data-construction-readiness]').textContent = 'Ready for review';
    } else {
      root.querySelector('[data-current-construction]').textContent = 'Not provided';
      root.querySelector('[data-current-construction-status]').textContent = 'Choose a requirement path';
      root.querySelector('[data-construction-readiness]').textContent = 'Choose known or review';
    }
  };

  const updateVisual = () => {
    const selected = layers[state.selectedLayer];
    visual.dataset.view = state.view;
    root.querySelector('[data-construction-view-label]').textContent = state.view === 'exploded' ? 'Exploded View' : 'Combined View';
    root.querySelector('[data-construction-layer-title]').textContent = selected.title;
    root.querySelector('[data-construction-layer-description]').textContent = selected.description;
    root.querySelector('[data-construction-svg-description]').textContent = `${state.view === 'exploded' ? 'An exploded' : 'A combined'} conceptual view with ${selected.title} highlighted. Other construction elements remain visible.`;
    root.querySelectorAll('[data-construction-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.constructionView === state.view));
    });
    root.querySelectorAll('[data-construction-layer]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.constructionLayer === state.selectedLayer));
    });
    root.querySelectorAll('[data-construction-layer-visual]').forEach(layer => {
      layer.classList.toggle('is-selected', layer.dataset.constructionLayerVisual === state.selectedLayer);
    });
  };

  const getConfiguratorConstruction = () => {
    let current = { constructionKnown: '', construction: '', constructionNotes: '' };
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-construction-query', {
      detail: { respond: value => { if (value) current = value; } }
    }));
    return current;
  };

  const currentRequirement = () => ({
    constructionKnown: state.constructionKnown,
    construction: state.constructionKnown === 'yes' ? normalizeWhitespace(state.construction, 180) : '',
    constructionNotes: state.constructionKnown === 'yes' ? normalizeWhitespace(state.constructionNotes, 500) : ''
  });

  const requirementDiffers = current => {
    if (!current.constructionKnown) return false;
    const next = currentRequirement();
    return current.constructionKnown !== next.constructionKnown
      || current.construction !== next.construction
      || current.constructionNotes !== next.constructionNotes;
  };

  const applyRequirement = () => {
    const requirement = currentRequirement();
    if (requirement.constructionKnown === 'yes' && !requirement.construction) {
      showInputError();
      return;
    }
    if (requirement.constructionKnown === 'yes') {
      state.construction = requirement.construction;
      state.constructionNotes = requirement.constructionNotes;
      constructionInput.value = requirement.construction;
      notesInput.value = requirement.constructionNotes;
      updateCounts();
      updateRequirement();
    }
    clearInputError();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-construction-apply', { detail: requirement }));
  };

  const openConfirmation = () => {
    lastFocusedElement = document.activeElement;
    confirmation.hidden = false;
    document.body.classList.add('zlh-confirmation-open');
    confirmation.querySelector('[data-construction-cancel]').focus();
  };

  const closeConfirmation = (restoreFocus = true) => {
    confirmation.hidden = true;
    document.body.classList.remove('zlh-confirmation-open');
    if (restoreFocus) lastFocusedElement?.focus();
  };

  root.addEventListener('click', event => {
    const knownButton = event.target.closest('[data-construction-known-options] button[data-construction-known]');
    if (knownButton && ['yes', 'no'].includes(knownButton.dataset.constructionKnown)) {
      state.constructionKnown = knownButton.dataset.constructionKnown;
      if (state.constructionKnown === 'no') {
        state.construction = '';
        state.constructionNotes = '';
        constructionInput.value = '';
        notesInput.value = '';
        updateCounts();
      }
      clearFeedback();
      clearInputError();
      updateRequirement();
      if (state.constructionKnown === 'yes') constructionInput.focus();
      return;
    }

    const layerButton = event.target.closest('[data-construction-layer-options] button[data-construction-layer]');
    if (layerButton && layers[layerButton.dataset.constructionLayer]) {
      state.selectedLayer = layerButton.dataset.constructionLayer;
      updateVisual();
      return;
    }

    const viewButton = event.target.closest('button[data-construction-view]');
    if (viewButton && ['combined', 'exploded'].includes(viewButton.dataset.constructionView)) {
      state.view = viewButton.dataset.constructionView;
      updateVisual();
      return;
    }

    if (event.target.closest('[data-reset-construction-view]')) {
      state.selectedLayer = 'final';
      state.view = 'combined';
      updateVisual();
      return;
    }

    if (event.target.closest('[data-apply-construction]')) {
      if (state.constructionKnown === 'yes' && !normalizeWhitespace(state.construction, 180)) {
        showInputError();
        return;
      }
      if (requirementDiffers(getConfiguratorConstruction())) openConfirmation();
      else applyRequirement();
      return;
    }

    if (event.target.closest('[data-construction-cancel]')) {
      closeConfirmation();
      return;
    }

    if (event.target.closest('[data-construction-confirm]')) {
      closeConfirmation(false);
      applyRequirement();
      applyButton.focus();
    }
  });

  constructionInput.addEventListener('input', () => {
    state.construction = constructionInput.value;
    clearFeedback();
    clearInputError();
    updateCounts();
    updateRequirement();
  });

  notesInput.addEventListener('input', () => {
    state.constructionNotes = notesInput.value;
    clearFeedback();
    updateCounts();
    updateRequirement();
  });

  constructionInput.addEventListener('blur', () => {
    if (state.constructionKnown === 'yes' && !normalizeWhitespace(state.construction, 180)) showInputError(false);
  });

  const addArrowNavigation = (containerSelector, buttonSelector) => {
    root.querySelector(containerSelector).addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const buttons = Array.from(root.querySelectorAll(buttonSelector));
      const currentIndex = buttons.indexOf(document.activeElement);
      if (currentIndex < 0) return;
      event.preventDefault();
      const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      buttons[(currentIndex + (backwards ? -1 : 1) + buttons.length) % buttons.length].focus();
    });
  };

  addArrowNavigation('[data-construction-known-options]', '[data-construction-known-options] button');
  addArrowNavigation('.zlh-construction-view-toggle', '.zlh-construction-view-toggle button');
  addArrowNavigation('[data-construction-layer-options]', '[data-construction-layer-options] button');

  document.addEventListener('suvarnatantu:zari-construction-applied', event => {
    const requirement = currentRequirement();
    if (event.detail?.constructionKnown !== requirement.constructionKnown
      || event.detail?.construction !== requirement.construction
      || event.detail?.constructionNotes !== requirement.constructionNotes) return;
    feedback.textContent = requirement.constructionKnown === 'yes'
      ? 'Construction added to Build Your Zari. Other selections were preserved.'
      : 'Technical Review Required added to Build Your Zari. Other selections were preserved.';
    feedback.classList.add('is-success');
  });

  confirmation.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeConfirmation();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(confirmation.querySelectorAll('button:not([disabled])'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('suvarnatantu:zari-construction-lab-state-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond(currentRequirement());
  });

  updateCounts();
  updateRequirement();
  updateVisual();
})();
