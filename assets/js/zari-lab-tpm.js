(() => {
  'use strict';

  const root = document.querySelector('[data-tpm-explorer]');
  if (!root) return;

  const state = { tpmKnown: '', tpm: '', density: 3, previewDirection: 'S' };
  const densityCopy = ['Low visual density', 'Lower visual density', 'Medium visual density', 'Higher visual density', 'High visual density'];
  const densityLineCounts = [3, 4, 6, 8, 10];
  const input = root.querySelector('[data-tpm-input]');
  const inputWrap = root.querySelector('[data-tpm-input-wrap]');
  const inputError = root.querySelector('[data-tpm-error]');
  const slider = root.querySelector('[data-density-slider]');
  const applyButton = root.querySelector('[data-apply-tpm]');
  const feedback = root.querySelector('[data-tpm-feedback]');
  const visual = root.querySelector('[data-tpm-visual]');
  const confirmation = root.querySelector('[data-tpm-confirmation]');
  let lastFocusedElement = null;

  const cleanNumericInput = value => {
    const filtered = String(value || '').replace(/[^\d.]/g, '');
    const firstDecimal = filtered.indexOf('.');
    if (firstDecimal < 0) return filtered.slice(0, 12);
    return `${filtered.slice(0, firstDecimal + 1)}${filtered.slice(firstDecimal + 1).replace(/\./g, '')}`.slice(0, 12);
  };

  const normalizeTpm = value => {
    const cleaned = cleanNumericInput(value);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned) || Number(cleaned) <= 0) return '';
    const normalized = cleaned.startsWith('.') ? `0${cleaned}` : cleaned.endsWith('.') ? cleaned.slice(0, -1) : cleaned;
    return /^\d+(?:\.\d+)?$/.test(normalized) ? normalized : '';
  };

  const clearFeedback = () => {
    feedback.textContent = '';
    feedback.classList.remove('is-success');
  };

  const setLineVisibility = (elements, count) => {
    const visibleIndexes = new Set();
    for (let index = 0; index < count; index += 1) {
      visibleIndexes.add(Math.round(index * (elements.length - 1) / Math.max(1, count - 1)));
    }
    elements.forEach((element, index) => element.classList.toggle('is-visible', visibleIndexes.has(index)));
  };

  const updateVisual = () => {
    const densityIndex = state.density - 1;
    const densityLabel = densityCopy[densityIndex];
    const lineCount = densityLineCounts[densityIndex];
    root.querySelector('[data-density-output]').textContent = densityLabel;
    root.querySelector('[data-tpm-visual-label]').textContent = `${densityLabel} · ${state.previewDirection} preview`;
    root.querySelector('[data-tpm-comparison-label]').textContent = densityLabel;
    root.querySelector('[data-tpm-direction-letter]').textContent = state.previewDirection;
    root.querySelector('[data-tpm-svg-description]').textContent = `A conceptual vertical yarn with ${densityLabel.toLowerCase()} and visible ${state.previewDirection}-direction diagonal wraps.`;
    visual.dataset.previewDirection = state.previewDirection;
    root.querySelectorAll('[data-tpm-preview-options] button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.previewDirection === state.previewDirection));
    });
    root.querySelectorAll('.zlh-tpm-lines').forEach(group => setLineVisibility(Array.from(group.querySelectorAll('path')), lineCount));
    setLineVisibility(Array.from(root.querySelectorAll('[data-tpm-comparison-strand] i')), lineCount);
  };

  const updateRequirement = () => {
    root.querySelectorAll('[data-tpm-known-options] button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.tpmKnown === state.tpmKnown));
    });
    inputWrap.hidden = state.tpmKnown !== 'yes';
    applyButton.disabled = !state.tpmKnown;

    const validValue = normalizeTpm(state.tpm);
    if (state.tpmKnown === 'yes' && validValue) {
      root.querySelector('[data-current-tpm]').textContent = validValue;
      root.querySelector('[data-current-tpm-status]').textContent = 'Buyer-provided value';
      root.querySelector('[data-tpm-readiness]').textContent = 'Ready to use';
    } else if (state.tpmKnown === 'yes') {
      root.querySelector('[data-current-tpm]').textContent = 'Awaiting value';
      root.querySelector('[data-current-tpm-status]').textContent = 'Enter a positive value';
      root.querySelector('[data-tpm-readiness]').textContent = 'TPM value required';
    } else if (state.tpmKnown === 'no') {
      root.querySelector('[data-current-tpm]').textContent = 'Technical Review Required';
      root.querySelector('[data-current-tpm-status]').textContent = 'Technical Review Required';
      root.querySelector('[data-tpm-readiness]').textContent = 'Ready for review';
    } else {
      root.querySelector('[data-current-tpm]').textContent = 'Not provided';
      root.querySelector('[data-current-tpm-status]').textContent = 'Choose a requirement path';
      root.querySelector('[data-tpm-readiness]').textContent = 'Choose known or review';
    }
  };

  const showInputError = () => {
    inputError.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  };

  const clearInputError = () => {
    inputError.hidden = true;
    input.removeAttribute('aria-invalid');
  };

  const getConfiguratorTpm = () => {
    let current = { tpmKnown: '', tpm: '' };
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-tpm-query', {
      detail: { respond: value => { if (value) current = value; } }
    }));
    return current;
  };

  const applyRequirement = () => {
    const normalized = state.tpmKnown === 'yes' ? normalizeTpm(state.tpm) : '';
    if (state.tpmKnown === 'yes' && !normalized) {
      showInputError();
      return;
    }
    if (state.tpmKnown === 'yes') {
      state.tpm = normalized;
      input.value = normalized;
    }
    clearInputError();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-tpm-apply', {
      detail: { tpmKnown: state.tpmKnown, tpm: normalized }
    }));
  };

  const requirementDiffers = current => {
    if (!current.tpmKnown) return false;
    if (current.tpmKnown !== state.tpmKnown) return true;
    if (state.tpmKnown === 'no') return false;
    return normalizeTpm(current.tpm) !== normalizeTpm(state.tpm);
  };

  const openConfirmation = () => {
    lastFocusedElement = document.activeElement;
    confirmation.hidden = false;
    document.body.classList.add('zlh-confirmation-open');
    confirmation.querySelector('[data-tpm-cancel]').focus();
  };

  const closeConfirmation = (restoreFocus = true) => {
    confirmation.hidden = true;
    document.body.classList.remove('zlh-confirmation-open');
    if (restoreFocus) lastFocusedElement?.focus();
  };

  root.addEventListener('click', event => {
    const knownButton = event.target.closest('[data-tpm-known-options] button[data-tpm-known]');
    if (knownButton && ['yes', 'no'].includes(knownButton.dataset.tpmKnown)) {
      state.tpmKnown = knownButton.dataset.tpmKnown;
      if (state.tpmKnown === 'no') state.tpm = '';
      clearFeedback();
      clearInputError();
      updateRequirement();
      if (state.tpmKnown === 'yes') input.focus();
      return;
    }

    const previewButton = event.target.closest('[data-tpm-preview-options] button[data-preview-direction]');
    if (previewButton && ['S', 'Z'].includes(previewButton.dataset.previewDirection)) {
      state.previewDirection = previewButton.dataset.previewDirection;
      updateVisual();
      return;
    }

    if (event.target.closest('[data-reset-tpm-visual]')) {
      state.density = 3;
      state.previewDirection = 'S';
      slider.value = '3';
      updateVisual();
      return;
    }

    if (event.target.closest('[data-apply-tpm]')) {
      if (state.tpmKnown === 'yes' && !normalizeTpm(state.tpm)) {
        showInputError();
        return;
      }
      if (requirementDiffers(getConfiguratorTpm())) openConfirmation();
      else applyRequirement();
      return;
    }

    if (event.target.closest('[data-tpm-cancel]')) {
      closeConfirmation();
      return;
    }

    if (event.target.closest('[data-tpm-confirm]')) {
      closeConfirmation(false);
      applyRequirement();
      applyButton.focus();
    }
  });

  input.addEventListener('input', () => {
    const cleaned = cleanNumericInput(input.value);
    if (input.value !== cleaned) input.value = cleaned;
    state.tpm = cleaned;
    clearFeedback();
    clearInputError();
    updateRequirement();
  });

  slider.addEventListener('input', () => {
    state.density = Math.min(5, Math.max(1, Number(slider.value) || 3));
    updateVisual();
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

  addArrowNavigation('[data-tpm-known-options]', '[data-tpm-known-options] button');
  addArrowNavigation('[data-tpm-preview-options]', '[data-tpm-preview-options] button');

  document.addEventListener('suvarnatantu:zari-tpm-applied', event => {
    const normalized = state.tpmKnown === 'yes' ? normalizeTpm(state.tpm) : '';
    if (event.detail?.tpmKnown !== state.tpmKnown || event.detail?.tpm !== normalized) return;
    feedback.textContent = state.tpmKnown === 'yes'
      ? 'TPM added to Build Your Zari. Other selections were preserved.'
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

  document.addEventListener('suvarnatantu:zari-tpm-lab-state-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({
      tpmKnown: state.tpmKnown,
      tpm: state.tpmKnown === 'yes' ? normalizeTpm(state.tpm) : ''
    });
  });

  updateRequirement();
  updateVisual();
})();
