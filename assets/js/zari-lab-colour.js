(() => {
  'use strict';

  const root = document.querySelector('[data-colour-lab]');
  if (!root) return;

  const colours = ['Gold', 'Silver', 'Copper', 'Rose Gold', 'Antique', 'Coloured', 'Custom', 'Not Sure'];
  const finishes = ['Bright', 'Soft Metallic', 'Matte', 'Antique', 'Custom', 'Not Sure'];
  const state = { colour: '', finish: '', note: '' };
  const preview = root.querySelector('[data-colour-preview]');
  const customField = root.querySelector('[data-colour-custom]');
  const note = root.querySelector('[data-colour-note]');
  const applyButton = root.querySelector('[data-apply-colour]');
  const feedback = root.querySelector('[data-colour-feedback]');
  const confirmation = root.querySelector('[data-colour-confirmation]');
  let lastFocusedElement = null;

  const updateInterface = () => {
    root.querySelectorAll('[data-colour-options] button[data-colour]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.colour === state.colour));
    });
    root.querySelectorAll('[data-finish-options] button[data-finish]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.finish === state.finish));
    });

    const customSelected = state.colour === 'Custom' || state.finish === 'Custom';
    customField.hidden = !customSelected;
    note.disabled = !customSelected;
    preview.dataset.colour = state.colour || 'Neutral';
    preview.dataset.finish = state.finish || 'Neutral';
    root.querySelector('[data-preview-label]').textContent = state.colour && state.finish
      ? `${state.colour} · ${state.finish}`
      : state.colour || state.finish || 'Choose a direction';
    root.querySelector('[data-current-colour]').textContent = state.colour || 'Not selected';
    root.querySelector('[data-current-finish]').textContent = state.finish || 'Not selected';

    const reviewRequired = state.colour === 'Not Sure' || state.finish === 'Not Sure';
    const complete = Boolean(state.colour && state.finish);
    root.querySelector('[data-direction-status]').textContent = complete
      ? reviewRequired ? 'Technical review required' : 'Ready to use'
      : 'Choose colour and finish';
    root.querySelector('[data-current-status]').textContent = reviewRequired
      ? 'Technical review required'
      : 'Visual Reference Only';

    const noteRow = root.querySelector('[data-current-note-row]');
    noteRow.hidden = !customSelected || !state.note.trim();
    root.querySelector('[data-current-note]').textContent = state.note.trim();
    root.querySelector('[data-colour-note-count]').textContent = String(state.note.length);
    applyButton.disabled = !complete;
  };

  const clearFeedback = () => {
    feedback.textContent = '';
    feedback.classList.remove('is-success');
  };

  const getConfiguratorDirection = () => {
    let current = { colour: '', finish: '', colourCustom: '' };
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-colour-query', {
      detail: { respond: value => { if (value) current = value; } }
    }));
    return current;
  };

  const payload = () => ({
    colour: state.colour,
    finish: state.finish,
    colourCustom: state.colour === 'Custom' || state.finish === 'Custom' ? state.note.trim() : ''
  });

  const applyDirection = () => {
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-colour-apply', { detail: payload() }));
  };

  const openConfirmation = () => {
    lastFocusedElement = document.activeElement;
    confirmation.hidden = false;
    document.body.classList.add('zlh-confirmation-open');
    confirmation.querySelector('[data-colour-cancel]').focus();
  };

  const closeConfirmation = (restoreFocus = true) => {
    confirmation.hidden = true;
    document.body.classList.remove('zlh-confirmation-open');
    if (restoreFocus) lastFocusedElement?.focus();
  };

  root.addEventListener('click', event => {
    const colourButton = event.target.closest('[data-colour-options] button[data-colour]');
    if (colourButton && colours.includes(colourButton.dataset.colour)) {
      state.colour = colourButton.dataset.colour;
      clearFeedback();
      updateInterface();
      return;
    }

    const finishButton = event.target.closest('[data-finish-options] button[data-finish]');
    if (finishButton && finishes.includes(finishButton.dataset.finish)) {
      state.finish = finishButton.dataset.finish;
      clearFeedback();
      updateInterface();
      return;
    }

    if (event.target.closest('[data-apply-colour]')) {
      const current = getConfiguratorDirection();
      const next = payload();
      const replacementRequired = Boolean(
        (current.colour && current.colour !== next.colour)
        || (current.finish && current.finish !== next.finish)
        || (current.colourCustom && current.colourCustom !== next.colourCustom)
      );
      if (replacementRequired) openConfirmation();
      else applyDirection();
      return;
    }

    if (event.target.closest('[data-colour-cancel]')) {
      closeConfirmation();
      return;
    }

    if (event.target.closest('[data-colour-confirm]')) {
      closeConfirmation(false);
      applyDirection();
      applyButton.focus();
    }
  });

  note.addEventListener('input', () => {
    state.note = note.value.slice(0, 400);
    clearFeedback();
    updateInterface();
  });

  document.addEventListener('suvarnatantu:zari-colour-applied', event => {
    if (event.detail?.colour !== state.colour || event.detail?.finish !== state.finish) return;
    feedback.textContent = 'Direction added to Build Your Zari. Other selections were preserved.';
    feedback.classList.add('is-success');
  });

  root.querySelectorAll('[data-colour-options], [data-finish-options]').forEach(group => {
    group.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const buttons = Array.from(group.querySelectorAll('button'));
      const currentIndex = buttons.indexOf(document.activeElement);
      if (currentIndex < 0) return;
      event.preventDefault();
      const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      buttons[(currentIndex + (backwards ? -1 : 1) + buttons.length) % buttons.length].focus();
    });
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

  document.addEventListener('suvarnatantu:zari-colour-lab-state-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({ colour: state.colour, finish: state.finish, note: state.note.trim() });
  });

  updateInterface();
})();
