/**
 * Element metadata for CaptureStep enrichment (UC-0003).
 * TypeScript API for Node/tests; plain JS twin is inlined into CAPTURE_INIT_SCRIPT (ADR-0002).
 */

export type ElementMetadata = {
  ariaLabel?: string;
  closestHeader?: string;
  formContext?: string;
  placeholder?: string;
};

const MAX_LEN = 200;

/** Minimal Element surface used by the extractor (browser DOM or tests). */
export type MetadataElement = {
  nodeType: number;
  tagName: string;
  getAttribute(name: string): string | null;
  textContent: string | null;
  previousElementSibling: MetadataElement | null;
  parentElement: MetadataElement | null;
  querySelector(selectors: string): MetadataElement | null;
  closest(selectors: string): MetadataElement | null;
};

function trimText(raw: string | null | undefined, max = MAX_LEN): string | undefined {
  if (raw == null) return undefined;
  const t = String(raw).replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function headingText(el: MetadataElement): string | undefined {
  const tag = el.tagName.toUpperCase();
  if (/^H[1-6]$/.test(tag)) return trimText(el.textContent);
  const inner = el.querySelector('h1,h2,h3,h4,h5,h6');
  return inner ? trimText(inner.textContent) : undefined;
}

/**
 * Walk ancestors and previous siblings looking for the nearest heading.
 */
export function findClosestHeader(el: MetadataElement): string | undefined {
  let node: MetadataElement | null = el;
  while (node) {
    let sib: MetadataElement | null = node.previousElementSibling;
    while (sib) {
      const text = headingText(sib);
      if (text) return text;
      sib = sib.previousElementSibling;
    }
    const parent: MetadataElement | null = node.parentElement;
    if (parent) {
      const tag = parent.tagName.toUpperCase();
      if (/^H[1-6]$/.test(tag)) {
        const text = trimText(parent.textContent);
        if (text) return text;
      }
    }
    node = parent;
  }
  return undefined;
}

/**
 * Label for the nearest form or fieldset (legend → aria-label → name → id).
 */
export function findFormContext(el: MetadataElement): string | undefined {
  const scope = el.closest('fieldset, form');
  if (!scope) return undefined;

  if (scope.tagName.toUpperCase() === 'FIELDSET') {
    const legend = scope.querySelector('legend');
    const legendText = legend ? trimText(legend.textContent) : undefined;
    if (legendText) return legendText;
  }

  const aria = trimText(scope.getAttribute('aria-label'));
  if (aria) return aria;

  const name = trimText(scope.getAttribute('name'));
  if (name) return name;

  const id = trimText(scope.getAttribute('id'));
  if (id) return id;

  return undefined;
}

/**
 * Extract semantic metadata from a DOM element at capture time.
 */
export function extractElementMetadata(el: MetadataElement | null | undefined): ElementMetadata {
  if (!el || el.nodeType !== 1) return {};

  const out: ElementMetadata = {};

  const tag = el.tagName.toUpperCase();

  const ariaLabel =
    trimText(el.getAttribute('aria-label')) ||
    trimText(el.getAttribute('title')) ||
    (tag === 'IMG' ? trimText(el.getAttribute('alt')) : undefined);
  if (ariaLabel) out.ariaLabel = ariaLabel;

  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const placeholder = trimText(el.getAttribute('placeholder'));
    if (placeholder) out.placeholder = placeholder;
  }

  const closestHeader = findClosestHeader(el);
  if (closestHeader) out.closestHeader = closestHeader;

  const formContext = findFormContext(el);
  if (formContext) out.formContext = formContext;

  return out;
}

/**
 * Plain JS source of `extractElementMetadata` for Playwright init scripts (ADR-0002).
 * Must stay free of TypeScript syntax.
 */
export const EXTRACT_ELEMENT_METADATA_JS = `
function extractElementMetadata(el) {
  if (!el || el.nodeType !== 1) return {};
  var MAX_LEN = 200;
  function trimText(raw) {
    if (raw == null) return undefined;
    var t = String(raw).replace(/\\s+/g, ' ').trim();
    if (!t) return undefined;
    return t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t;
  }
  function headingText(node) {
    var tag = node.tagName.toUpperCase();
    if (/^H[1-6]$/.test(tag)) return trimText(node.textContent);
    var inner = node.querySelector('h1,h2,h3,h4,h5,h6');
    return inner ? trimText(inner.textContent) : undefined;
  }
  function findClosestHeader(node) {
    var cur = node;
    while (cur) {
      var sib = cur.previousElementSibling;
      while (sib) {
        var ht = headingText(sib);
        if (ht) return ht;
        sib = sib.previousElementSibling;
      }
      var parent = cur.parentElement;
      if (parent) {
        var ptag = parent.tagName.toUpperCase();
        if (/^H[1-6]$/.test(ptag)) {
          var pt = trimText(parent.textContent);
          if (pt) return pt;
        }
      }
      cur = parent;
    }
    return undefined;
  }
  function findFormContext(node) {
    if (!node.closest) return undefined;
    var scope = node.closest('fieldset, form');
    if (!scope) return undefined;
    if (scope.tagName.toUpperCase() === 'FIELDSET') {
      var legend = scope.querySelector('legend');
      var legendText = legend ? trimText(legend.textContent) : undefined;
      if (legendText) return legendText;
    }
    var aria = trimText(scope.getAttribute('aria-label'));
    if (aria) return aria;
    var name = trimText(scope.getAttribute('name'));
    if (name) return name;
    var id = trimText(scope.getAttribute('id'));
    if (id) return id;
    return undefined;
  }
  var out = {};
  var tag = el.tagName.toUpperCase();
  var ariaLabel =
    trimText(el.getAttribute('aria-label')) ||
    trimText(el.getAttribute('title')) ||
    (tag === 'IMG' ? trimText(el.getAttribute('alt')) : undefined);
  if (ariaLabel) out.ariaLabel = ariaLabel;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    var placeholder = trimText(el.getAttribute('placeholder'));
    if (placeholder) out.placeholder = placeholder;
  }
  var closestHeader = findClosestHeader(el);
  if (closestHeader) out.closestHeader = closestHeader;
  var formContext = findFormContext(el);
  if (formContext) out.formContext = formContext;
  return out;
}
`.trim();

/**
 * Plain JS: primary nav / sidebar click → module label (UC-0011). Not submenus.
 */
export const DETECT_PRIMARY_NAV_MODULE_JS = `
function detectPrimaryNavModule(el) {
  if (!el || el.nodeType !== 1 || !el.closest) return undefined;
  var MAX_LEN = 80;
  function trimText(raw) {
    if (raw == null) return undefined;
    var t = String(raw).replace(/\\s+/g, ' ').trim();
    if (!t) return undefined;
    return t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t;
  }
  // Overflow / listbox / dialog menus are not the primary module rail.
  if (el.closest('[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]')) {
    return undefined;
  }
  var root = el.closest(
    'nav, [role="navigation"], aside, [class*="sidebar"], [class*="side-nav"], [class*="sidenav"], [class*="SideNav"], [class*="main-nav"], [class*="main-menu"]'
  );
  if (!root) return undefined;
  var item =
    el.closest('a, [role="menuitem"], [role="tab"], [role="link"], button, [role="button"]') || el;
  var text = trimText(item.innerText || item.textContent);
  if (!text || text.length < 2) return undefined;
  if (/^(acciones|más|more|menu|options)$/i.test(text)) return undefined;
  return text;
}
`.trim();

export const MetadataExtractor = {
  extractElementMetadata,
  findClosestHeader,
  findFormContext,
} as const;
