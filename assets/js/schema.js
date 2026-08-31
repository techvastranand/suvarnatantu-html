(() => {
  const origin = 'https://suvarnatantu.com';
  const collectionPages = new Set([
    '/applications/', '/colours/', '/industries/', '/manufacturing/', '/metallic-yarn/',
    '/products/', '/specifications/', '/zari-lab/', '/zari-yarn/'
  ]);
  const productPages = new Set([
    '/metallic-yarn/custom/', '/metallic-yarn/m-type/', '/metallic-yarn/mh-type/', '/metallic-yarn/mx-type/', '/metallic-yarn/st-type/',
    '/products/filament-yarn/nylon-filament-yarn/', '/products/filament-yarn/polyester-filament-yarn/', '/products/filament-yarn/specialty-filament-yarn/',
    '/products/metallic-zari/special-finish-metallic-zari/', '/products/twisted-yarn/custom-tpm-yarn/', '/products/twisted-yarn/s-twist-yarn/',
    '/products/twisted-yarn/z-twist-yarn/', '/zari-yarn/coloured-zari/', '/zari-yarn/embroidery-zari/', '/zari-yarn/imitation-zari/',
    '/zari-yarn/polyester-zari/', '/zari-yarn/weaving-zari/'
  ]);
  const parentPages = [
    ['/products/', 'Products'], ['/products/filament-yarn/', 'Filament Yarn'], ['/products/metallic-zari/', 'Metallic Zari'],
    ['/products/twisted-yarn/', 'Twisted Yarn'], ['/metallic-yarn/', 'Metallic Yarn'], ['/zari-yarn/', 'Zari Yarn'],
    ['/applications/', 'Applications'], ['/colours/', 'Colours'], ['/industries/', 'Industries'], ['/manufacturing/', 'Manufacturing'],
    ['/zari-lab/', 'Zari Lab'], ['/specifications/', 'Specifications'], ['/exports/', 'Exports']
  ];
  const text = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const absoluteUrl = (value) => {
    try {
      const url = new URL(value, origin);
      if (url.origin !== origin) return null;
      url.search = '';
      url.hash = '';
      return url.href;
    } catch { return null; }
  };
  const breadcrumb = (url, name) => {
    const items = [{ name: 'Home', item: `${origin}/` }];
    const nav = document.querySelector('nav.breadcrumb');
    if (nav) {
      nav.querySelectorAll('a[href]').forEach((anchor) => {
        const item = absoluteUrl(anchor.href);
        const label = text(anchor.textContent);
        if (item && label && !items.some((entry) => entry.item === item)) items.push({ name: label, item });
      });
    } else {
      parentPages.forEach(([path, label]) => {
        if (path !== url.slice(origin.length) && url.startsWith(`${origin}${path}`)) items.push({ name: label, item: `${origin}${path}` });
      });
    }
    if (!items.some((entry) => entry.item === url)) items.push({ name, item: url });
    return {
      '@type': 'BreadcrumbList',
      itemListElement: items.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, name: entry.name, item: entry.item }))
    };
  };
  const addSchema = () => {
    if (document.getElementById('site-schema')) return;
    if ((document.querySelector('meta[name="robots"]')?.content || '').toLowerCase().includes('noindex')) return;
    const url = absoluteUrl(document.querySelector('link[rel="canonical"]')?.href);
    const name = text(document.querySelector('h1')?.textContent);
    const description = document.querySelector('meta[name="description"]')?.content?.trim();
    if (!url || !name || !description) return;
    const path = new URL(url).pathname;
    const pageType = path === '/about-us/' ? 'AboutPage' : path === '/contact/' ? 'ContactPage' : collectionPages.has(path) ? 'CollectionPage' : 'WebPage';
    const graph = [{ '@type': pageType, name, description, url }];
    if (path === '/') graph.push({ '@type': 'WebSite', name: 'Suvarnatantu', url: `${origin}/` });
    if (path !== '/') graph.push(breadcrumb(url, name));
    if (productPages.has(path)) graph.push({ '@type': 'Product', name, description, url });
    const script = document.createElement('script');
    script.id = 'site-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    document.head.append(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addSchema, { once: true });
  else addSchema();
})();
