(() => {
  const APPLICATIONS = Object.freeze({
    saree: { label: 'Saree', href: '/applications/saree/' },
    jacquard: { label: 'Jacquard', href: '/applications/jacquard/' },
    brocade: { label: 'Brocade', href: '/applications/brocade/' },
    embroidery: { label: 'Embroidery', href: '/applications/embroidery/' },
    knitting: { label: 'Knitting', href: '/applications/knitting/' },
    lace: { label: 'Lace', href: '/applications/lace/' },
    weaving: { label: 'Weaving', href: '/applications/weaving/' },
    'home-furnishing': { label: 'Home Furnishing', href: '/applications/home-furnishing/' },
    'decorative-textiles': { label: 'Decorative Textiles', href: '/applications/decorative-textiles/' },
    other: { label: 'custom application', href: '/applications/' }
  });

  const REQUIREMENTS = Object.freeze({
    'metallic-yarn': { label: 'Metallic Yarn', href: '/metallic-yarn/' },
    'zari-yarn': { label: 'Zari Yarn', href: '/zari-yarn/' },
    'filament-yarn': { label: 'Filament Yarn', href: '/products/filament-yarn/' },
    'twisted-yarn': { label: 'Twisted Yarn', href: '/products/twisted-yarn/' },
    'colour-finish': { label: 'Colour & Finish', href: '/colours/' }
  });

  const ZARI_LAB = '/zari-lab/#build-your-zari';
  const RFQ = '/request-quote/';
  const SAMPLES = '/samples/';
  const RFQ_APPLICATIONS = Object.freeze({
    saree: 'saree', jacquard: 'jacquard', brocade: 'brocade', embroidery: 'embroidery',
    knitting: 'knitting', lace: 'lace', 'home-furnishing': 'home-furnishing',
    'decorative-textiles': 'decorative-textiles'
  });
  const RFQ_FAMILIES = Object.freeze({
    'metallic-yarn': 'metallic-yarn', 'zari-yarn': 'zari-yarn',
    'filament-yarn': 'filament-yarn', 'twisted-yarn': 'twisted-yarn',
    'colour-finish': 'colours-finishes'
  });

  const link = (label, href) => ({ label, href });
  const applicationLink = application => link(
    application === APPLICATIONS.other ? 'Explore Application Routes' : `View ${application.label} Application`,
    application.href
  );
  const rfqLink = (selection, label = 'Request a Quote') => {
    const query = [];
    const family = RFQ_FAMILIES[selection?.requirement];
    const application = RFQ_APPLICATIONS[selection?.application];
    if (family) query.push(`family=${family}`);
    if (application) query.push(`application=${application}`);
    return link(label, query.length ? `${RFQ}?${query.join('&')}` : RFQ);
  };

  const recommend = selection => {
    const application = APPLICATIONS[selection?.application];
    const knowledge = selection?.knowledge;
    if (!application || !['yes', 'some', 'no'].includes(knowledge) || !selection?.requirement) return null;

    const context = applicationLink(application);
    if (selection.requirement === 'not-sure') {
      return {
        kicker: 'Recommended next step',
        heading: 'Not sure which construction you need?',
        copy: 'Share your application and known parameters to prepare a technical Requirement Brief. No yarn construction is assumed.',
        primary: link('Open Zari Lab', ZARI_LAB),
        secondary: context,
        context: null
      };
    }

    if (selection.requirement === 'custom-development') {
      const needsGuidance = knowledge !== 'yes';
      return {
        kicker: 'Recommended next step',
        heading: 'Your requirement may need technical review.',
        copy: `Start a custom requirement for your ${application.label} application using the information and references already available.`,
        primary: needsGuidance ? link('Start Custom Requirement', ZARI_LAB) : rfqLink(selection, 'Start Custom Requirement'),
        secondary: needsGuidance ? rfqLink(selection) : link('Request a Sample', SAMPLES),
        context
      };
    }

    const requirement = REQUIREMENTS[selection.requirement];
    if (!requirement) return null;

    if (knowledge === 'no') {
      return {
        kicker: 'Recommended next step',
        heading: 'Prepare your requirement in Zari Lab',
        copy: `Organise the known details for your ${application.label} application before reviewing the ${requirement.label} family.`,
        primary: link('Open Zari Lab', ZARI_LAB),
        secondary: link(`View ${requirement.label}`, requirement.href),
        context
      };
    }

    return {
      kicker: 'Suggested starting point',
      heading: `Explore ${requirement.label}`,
      copy: `Start with the ${requirement.label} family for your ${application.label} requirement. Final suitability may require technical review.`,
      primary: link(`View ${requirement.label}`, requirement.href),
      secondary: knowledge === 'yes' ? rfqLink(selection, 'Continue to RFQ') : link('Build Requirement in Zari Lab', ZARI_LAB),
      context
    };
  };

  window.SuvarnatantuProductFinder = Object.freeze({ APPLICATIONS, REQUIREMENTS, RFQ_APPLICATIONS, RFQ_FAMILIES, recommend });
  if (typeof document === 'undefined') return;

  const form = document.querySelector('[data-product-finder]');
  if (!form) return;

  const result = document.querySelector('[data-product-finder-result]');
  const validation = document.querySelector('[data-product-finder-validation]');
  const controls = [...form.querySelectorAll('select[required]')];
  let hasSubmitted = false;

  const selection = () => Object.fromEntries(controls.map(control => [control.name, control.value]));
  const setLink = (element, target) => {
    element.textContent = target.label;
    element.href = target.href;
  };
  const clearValidation = () => {
    validation.textContent = '';
    controls.forEach(control => control.removeAttribute('aria-invalid'));
  };
  const render = ({ focusMissing = false } = {}) => {
    const missing = controls.filter(control => !control.value);
    clearValidation();
    if (missing.length) {
      missing.forEach(control => control.setAttribute('aria-invalid', 'true'));
      validation.textContent = 'Choose an application, requirement and specification knowledge to continue.';
      result.hidden = true;
      if (focusMissing) missing[0].focus();
      return false;
    }

    const recommendation = recommend(selection());
    if (!recommendation) {
      validation.textContent = 'We could not prepare a route from those selections. Please review your choices.';
      result.hidden = true;
      return false;
    }

    result.querySelector('[data-product-finder-kicker]').textContent = recommendation.kicker;
    result.querySelector('[data-product-finder-heading]').textContent = recommendation.heading;
    result.querySelector('[data-product-finder-copy]').textContent = recommendation.copy;
    setLink(result.querySelector('[data-product-finder-primary]'), recommendation.primary);
    setLink(result.querySelector('[data-product-finder-secondary]'), recommendation.secondary);
    const context = result.querySelector('[data-product-finder-context]');
    context.hidden = !recommendation.context;
    if (recommendation.context) setLink(context, recommendation.context);
    else {
      context.textContent = '';
      context.removeAttribute('href');
    }
    result.hidden = false;
    return true;
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    hasSubmitted = true;
    render({ focusMissing: true });
  });
  form.addEventListener('change', () => {
    const changed = document.activeElement;
    if (changed?.value) changed.removeAttribute('aria-invalid');
    if (hasSubmitted) render();
  });
})();
