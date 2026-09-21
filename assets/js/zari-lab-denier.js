(() => {
  'use strict';

  const root = document.querySelector('[data-denier-explorer]');
  if (!root) return;

  const state = { denierKnown: '', denier: '', fineness: 3 };
  const finenessCopy = ['Finer visual strand', 'Slightly finer visual strand', 'Intermediate visual strand', 'Heavier visual strand', 'Heaviest visual strand'];
  const finenessScales = [0.42, 0.68, 1, 1.34, 1.68];
  const input = root.querySelector('[data-denier-input]');
  const inputWrap = root.querySelector('[data-denier-input-wrap]');
  const inputError = root.querySelector('[data-denier-error]');
  const slider = root.querySelector('[data-fineness-slider]');
  const applyButton = root.querySelector('[data-apply-denier]');
  const feedback = root.querySelector('[data-denier-feedback]');
  const confirmation = root.querySelector('[data-denier-confirmation]');
  const mainStrand = root.querySelector('[data-denier-main-strand]');
  let lastFocusedElement = null;

  const validDenier = value => {
    const candidate = typeof value === 'string' ? value : '';
    return /^\d+(?:\.\d+)?$/.test(candidate) && Number(candidate) > 0 ? candidate : '';
  };

  const clearFeedback = () => {
    feedback.textContent = '';
    feedback.classList.remove('is-success');
  };

  const clearInputError = () => {
    inputError.hidden = true;
    input.removeAttribute('aria-invalid');
  };

  const showInputError = (moveFocus = true) => {
    inputError.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    if (moveFocus) input.focus();
  };

  const updateRequirement = () => {
    root.querySelectorAll('[data-denier-known-options] button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.denierKnown === state.denierKnown));
    });
    inputWrap.hidden = state.denierKnown !== 'yes';
    applyButton.disabled = !state.denierKnown;

    const value = validDenier(state.denier);
    if (state.denierKnown === 'yes' && value) {
      root.querySelector('[data-current-denier]').textContent = value;
      root.querySelector('[data-current-denier-status]').textContent = 'Buyer-provided value';
      root.querySelector('[data-denier-readiness]').textContent = 'Ready to use';
    } else if (state.denierKnown === 'yes') {
      root.querySelector('[data-current-denier]').textContent = 'Awaiting value';
      root.querySelector('[data-current-denier-status]').textContent = 'Enter a positive value';
      root.querySelector('[data-denier-readiness]').textContent = 'Denier value required';
    } else if (state.denierKnown === 'no') {
      root.querySelector('[data-current-denier]').textContent = 'Technical Review Required';
      root.querySelector('[data-current-denier-status]').textContent = 'Technical Review Required';
      root.querySelector('[data-denier-readiness]').textContent = 'Ready for review';
    } else {
      root.querySelector('[data-current-denier]').textContent = 'Not provided';
      root.querySelector('[data-current-denier-status]').textContent = 'Choose a requirement path';
      root.querySelector('[data-denier-readiness]').textContent = 'Choose known or review';
    }
  };

  const updateVisual = () => {
    const index = state.fineness - 1;
    const label = finenessCopy[index];
    mainStrand.style.setProperty('--denier-scale', String(finenessScales[index]));
    root.querySelector('[data-fineness-output]').textContent = label;
    root.querySelector('[data-denier-visual-label]').textContent = label;
    root.querySelector('[data-denier-svg-description]').textContent = `A conceptual ${label.toLowerCase()} shown without a calibrated Denier value.`;
  };

  const getConfiguratorDenier = () => {
    let current = { denierKnown: '', denier: '' };
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-denier-query', {
      detail: { respond: value => { if (value) current = value; } }
    }));
    return current;
  };

  const applyRequirement = () => {
    const value = state.denierKnown === 'yes' ? validDenier(state.denier) : '';
    if (state.denierKnown === 'yes' && !value) {
      showInputError();
      return;
    }
    clearInputError();
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-denier-apply', {
      detail: { denierKnown: state.denierKnown, denier: value }
    }));
  };

  const requirementDiffers = current => {
    if (!current.denierKnown) return false;
    if (current.denierKnown !== state.denierKnown) return true;
    if (state.denierKnown === 'no') return false;
    return current.denier !== state.denier;
  };

  const openConfirmation = () => {
    lastFocusedElement = document.activeElement;
    confirmation.hidden = false;
    document.body.classList.add('zlh-confirmation-open');
    confirmation.querySelector('[data-denier-cancel]').focus();
  };

  const closeConfirmation = (restoreFocus = true) => {
    confirmation.hidden = true;
    document.body.classList.remove('zlh-confirmation-open');
    if (restoreFocus) lastFocusedElement?.focus();
  };

  root.addEventListener('click', event => {
    const knownButton = event.target.closest('[data-denier-known-options] button[data-denier-known]');
    if (knownButton && ['yes', 'no'].includes(knownButton.dataset.denierKnown)) {
      state.denierKnown = knownButton.dataset.denierKnown;
      if (state.denierKnown === 'no') {
        state.denier = '';
        input.value = '';
      }
      clearFeedback();
      clearInputError();
      updateRequirement();
      if (state.denierKnown === 'yes') input.focus();
      return;
    }

    if (event.target.closest('[data-reset-denier-visual]')) {
      state.fineness = 3;
      slider.value = '3';
      updateVisual();
      return;
    }

    if (event.target.closest('[data-apply-denier]')) {
      if (state.denierKnown === 'yes' && !validDenier(state.denier)) {
        showInputError();
        return;
      }
      if (requirementDiffers(getConfiguratorDenier())) openConfirmation();
      else applyRequirement();
      return;
    }

    if (event.target.closest('[data-denier-cancel]')) {
      closeConfirmation();
      return;
    }

    if (event.target.closest('[data-denier-confirm]')) {
      closeConfirmation(false);
      applyRequirement();
      applyButton.focus();
    }
  });

  input.addEventListener('beforeinput', event => {
    if (!event.inputType.startsWith('insert') || event.data === null) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const candidate = `${input.value.slice(0, start)}${event.data}${input.value.slice(end)}`;
    if (!/^\d*\.?\d*$/.test(candidate) || candidate.length > 12) event.preventDefault();
  });

  input.addEventListener('paste', event => {
    const pasted = event.clipboardData?.getData('text') || '';
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const candidate = `${input.value.slice(0, start)}${pasted}${input.value.slice(end)}`;
    if (!/^\d*\.?\d*$/.test(candidate) || candidate.length > 12) event.preventDefault();
  });

  input.addEventListener('input', () => {
    state.denier = input.value;
    clearFeedback();
    clearInputError();
    updateRequirement();
  });

  input.addEventListener('blur', () => {
    if (state.denierKnown === 'yes' && !validDenier(state.denier)) showInputError(false);
  });

  slider.addEventListener('input', () => {
    state.fineness = Math.min(5, Math.max(1, Number(slider.value) || 3));
    updateVisual();
  });

  root.querySelector('[data-denier-known-options]').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const buttons = Array.from(root.querySelectorAll('[data-denier-known-options] button'));
    const currentIndex = buttons.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    buttons[(currentIndex + (backwards ? -1 : 1) + buttons.length) % buttons.length].focus();
  });

  document.addEventListener('suvarnatantu:zari-denier-applied', event => {
    const value = state.denierKnown === 'yes' ? validDenier(state.denier) : '';
    if (event.detail?.denierKnown !== state.denierKnown || event.detail?.denier !== value) return;
    feedback.textContent = state.denierKnown === 'yes'
      ? 'Denier added to Build Your Zari. Other selections were preserved.'
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

  document.addEventListener('suvarnatantu:zari-denier-lab-state-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({
      denierKnown: state.denierKnown,
      denier: state.denierKnown === 'yes' ? validDenier(state.denier) : ''
    });
  });

  updateRequirement();
  updateVisual();
})();
