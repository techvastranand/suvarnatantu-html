(() => {
  'use strict';

  const root = document.querySelector('[data-twist-lab]');
  if (!root) return;

  const directions = ['S Twist', 'Z Twist', 'Not Sure'];
  const state = { twist: '', letterGuide: true, compare: false };
  const visual = root.querySelector('[data-twist-visual]');
  const applyButton = root.querySelector('[data-apply-twist]');
  const feedback = root.querySelector('[data-twist-feedback]');
  const confirmation = root.querySelector('[data-twist-confirmation]');
  const copy = {
    'S Twist': {
      caption: 'S Twist direction',
      detail: 'The visible surface lines slope from upper left to lower right, matching the centre stroke of S.',
      description: 'A vertical yarn with repeated surface lines sloping from upper left to lower right, matching the centre stroke of the letter S.'
    },
    'Z Twist': {
      caption: 'Z Twist direction',
      detail: 'The visible surface lines slope from upper right to lower left, matching the centre stroke of Z.',
      description: 'A vertical yarn with repeated surface lines sloping from upper right to lower left, matching the centre stroke of the letter Z.'
    },
    'Not Sure': {
      caption: 'Technical Review Required',
      detail: 'No twist direction has been identified. Continue with a yarn or fabric reference where available.',
      description: 'A neutral vertical yarn without a selected S or Z direction. Technical review is required.'
    }
  };
  let lastFocusedElement = null;

  const updateInterface = () => {
    root.querySelectorAll('[data-twist-options] button[data-twist]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.twist === state.twist));
    });
    visual.dataset.direction = state.twist || 'Neutral';
    visual.dataset.letterGuide = String(state.letterGuide);
    root.querySelector('[data-single-twist]').hidden = state.compare;
    root.querySelector('[data-twist-comparison]').hidden = !state.compare;

    const selectedCopy = copy[state.twist];
    root.querySelector('[data-twist-visual-label]').textContent = state.compare
      ? 'S & Z comparison'
      : state.twist || 'Choose S, Z or Not Sure';
    root.querySelector('[data-current-twist]').textContent = state.twist || 'Not selected';
    root.querySelector('[data-current-twist-status]').textContent = state.twist === 'Not Sure'
      ? 'Technical Review Required'
      : state.twist ? 'Buyer-selected direction' : 'Requirement direction only';
    root.querySelector('[data-twist-readiness]').textContent = state.twist
      ? state.twist === 'Not Sure' ? 'Technical review required' : 'Ready to use'
      : 'Choose a direction';
    root.querySelector('[data-twist-unsure]').hidden = state.twist !== 'Not Sure';
    root.querySelector('[data-twist-caption-title]').textContent = selectedCopy?.caption || 'No direction selected';
    root.querySelector('[data-twist-caption-copy]').textContent = selectedCopy?.detail || 'Select S Twist, Z Twist or Not Sure to update the visual guide.';
    root.querySelector('[data-twist-svg-description]').textContent = selectedCopy?.description || 'A neutral yarn strand awaiting a twist direction selection.';
    applyButton.disabled = !state.twist;
  };

  const clearFeedback = () => {
    feedback.textContent = '';
    feedback.classList.remove('is-success');
  };

  const getConfiguratorTwist = () => {
    let current = { twist: '' };
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-twist-query', {
      detail: { respond: value => { if (value) current = value; } }
    }));
    return current.twist || '';
  };

  const applyDirection = () => {
    document.dispatchEvent(new CustomEvent('suvarnatantu:zari-twist-apply', {
      detail: { twist: state.twist }
    }));
  };

  const openConfirmation = () => {
    lastFocusedElement = document.activeElement;
    confirmation.hidden = false;
    document.body.classList.add('zlh-confirmation-open');
    confirmation.querySelector('[data-twist-cancel]').focus();
  };

  const closeConfirmation = (restoreFocus = true) => {
    confirmation.hidden = true;
    document.body.classList.remove('zlh-confirmation-open');
    if (restoreFocus) lastFocusedElement?.focus();
  };

  root.addEventListener('click', event => {
    const directionButton = event.target.closest('[data-twist-options] button[data-twist]');
    if (directionButton && directions.includes(directionButton.dataset.twist)) {
      state.twist = directionButton.dataset.twist;
      clearFeedback();
      updateInterface();
      return;
    }

    if (event.target.closest('[data-apply-twist]')) {
      const current = getConfiguratorTwist();
      if (current && current !== state.twist) openConfirmation();
      else applyDirection();
      return;
    }

    if (event.target.closest('[data-twist-cancel]')) {
      closeConfirmation();
      return;
    }

    if (event.target.closest('[data-twist-confirm]')) {
      closeConfirmation(false);
      applyDirection();
      applyButton.focus();
    }
  });

  root.querySelector('[data-letter-guide-toggle]').addEventListener('change', event => {
    state.letterGuide = event.target.checked;
    updateInterface();
  });

  root.querySelector('[data-compare-twist]').addEventListener('change', event => {
    state.compare = event.target.checked;
    updateInterface();
  });

  document.addEventListener('suvarnatantu:zari-twist-applied', event => {
    if (event.detail?.twist !== state.twist) return;
    feedback.textContent = 'Twist direction added to Build Your Zari. Other selections were preserved.';
    feedback.classList.add('is-success');
  });

  root.querySelector('[data-twist-options]').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const buttons = Array.from(root.querySelectorAll('[data-twist-options] button'));
    const currentIndex = buttons.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    buttons[(currentIndex + (backwards ? -1 : 1) + buttons.length) % buttons.length].focus();
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

  document.addEventListener('suvarnatantu:zari-twist-lab-state-query', event => {
    if (typeof event.detail?.respond !== 'function') return;
    event.detail.respond({ twist: state.twist });
  });

  updateInterface();
})();
