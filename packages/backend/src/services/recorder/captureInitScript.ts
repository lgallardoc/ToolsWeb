import { EXTRACT_ELEMENT_METADATA_JS } from '../MetadataExtractor.js';

/**
 * Plain browser JS injected via Playwright addInitScript({ content }).
 * Must stay free of TypeScript syntax (Playwright serializes/evals as-is).
 * Metadata extraction source comes from MetadataExtractor (UC-0003 / ADR-0002).
 * Gated by ENABLE_AVATAR_SCRIPT (UC-0004).
 */
export function buildCaptureInitScript(options: { enableAvatarScript: boolean }): string {
  const enableFlag = options.enableAvatarScript ? 'true' : 'false';
  return `
(function () {
  var w = window;
  // Reinstall when Node sets __toolswebForceReinstall (broken listeners / SPA).
  if (w.__toolswebListenersOk && !w.__toolswebForceReinstall) return;
  if (w.__toolswebAbort && typeof w.__toolswebAbort.abort === 'function') {
    try { w.__toolswebAbort.abort(); } catch (e) { /* ignore */ }
  }
  w.__toolswebForceReinstall = false;
  w.__toolswebListenersOk = false;
  w.__toolswebInstalled = false;
  w.__toolswebEnableAvatarScript = ${enableFlag};
  w.__toolswebQueue = Array.isArray(w.__toolswebQueue) ? w.__toolswebQueue : [];
  w.__toolswebAbort =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  var listenerOpts = w.__toolswebAbort
    ? { capture: true, signal: w.__toolswebAbort.signal }
    : true;

  var HIGHLIGHT_ID = '__toolsweb_highlight__';
  var CURSOR_ID = '__toolsweb_cursor__';
  var STYLE_ID = '__toolsweb_capture_styles__';

  ${EXTRACT_ELEMENT_METADATA_JS}

  function applyMetadata(payload, el) {
    if (!w.__toolswebEnableAvatarScript) return payload;
    var meta = extractElementMetadata(el);
    if (meta.ariaLabel) payload.ariaLabel = meta.ariaLabel;
    if (meta.closestHeader) payload.closestHeader = meta.closestHeader;
    if (meta.formContext) payload.formContext = meta.formContext;
    if (meta.placeholder) payload.placeholder = meta.placeholder;
    return payload;
  }

  function ensureStyles() {
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }
    style.textContent = ''
      + '@keyframes toolsweb-cursor-pop {'
      + '0%{transform:translate(0,0) scale(0.85);opacity:0.55;}'
      + '45%{transform:translate(0,0) scale(1.08);opacity:1;}'
      + '100%{transform:translate(0,0) scale(1);opacity:1;}'
      + '}'
      + '@keyframes toolsweb-ring {'
      + '0%{box-shadow:0 0 0 0 rgba(239,68,68,0.55);}'
      + '100%{box-shadow:0 0 0 14px rgba(239,68,68,0);}'
      + '}';
  }

  function isToolswebChrome(target) {
    return !!(target && target.closest && target.closest('[data-toolsweb="chrome"]'));
  }

  // Floating Detener removed (UC-0002 updated) — stop from Toolsweb UI only.
  w.__toolswebSetChromeVisible = function () { /* no-op */ };

  ensureStyles();

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\\\\]^\`{|}~])/g, '\\\\$1');
  }

  function buildSelector(el) {
    if (el.id) return '#' + cssEscape(el.id);

    var testId = el.getAttribute('data-testid');
    if (testId) return '[data-testid="' + cssEscape(testId) + '"]';

    var name = el.getAttribute('name');
    if (name) {
      return el.tagName.toLowerCase() + '[name="' + cssEscape(name) + '"]';
    }

    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      var part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift('#' + cssEscape(node.id));
        break;
      }
      var parent = node.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === node.tagName;
        });
        if (siblings.length > 1) {
          var index = Array.prototype.indexOf.call(siblings, node) + 1;
          part += ':nth-of-type(' + index + ')';
        }
      }
      parts.unshift(part);
      node = parent;
      depth += 1;
      if (node && node.tagName.toLowerCase() === 'body') break;
    }
    return parts.join(' > ');
  }

  function getBoundingBox(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  function visibleText(el) {
    var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text) return null;
    return text.slice(0, 120);
  }

  function clearHighlight() {
    var existing = document.getElementById(HIGHLIGHT_ID);
    if (existing) existing.remove();
    var cursor = document.getElementById(CURSOR_ID);
    if (cursor) cursor.remove();
  }

  function showHighlight(box, clickPoint, kind) {
    ensureStyles();
    clearHighlight();

    var overlay = document.createElement('div');
    overlay.id = HIGHLIGHT_ID;
    overlay.setAttribute('data-toolsweb', 'highlight');
    overlay.style.position = 'fixed';
    overlay.style.left = Math.max(0, box.x - 6) + 'px';
    overlay.style.top = Math.max(0, box.y - 6) + 'px';
    overlay.style.width = (box.width + 12) + 'px';
    overlay.style.height = (box.height + 12) + 'px';
    overlay.style.border = kind === 'click' ? '3px solid #ef4444' : '3px solid #10b981';
    overlay.style.borderRadius = '8px';
    overlay.style.background = kind === 'click' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.10)';
    overlay.style.boxShadow = kind === 'click'
      ? '0 0 0 3px rgba(239,68,68,0.35), 0 8px 24px rgba(0,0,0,0.18)'
      : '0 0 0 3px rgba(16,185,129,0.28), 0 8px 24px rgba(0,0,0,0.14)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483646';
    overlay.style.boxSizing = 'border-box';
    if (kind === 'click') overlay.style.animation = 'toolsweb-ring 0.7s ease-out infinite';
    document.documentElement.appendChild(overlay);

    if (clickPoint && typeof clickPoint.x === 'number' && typeof clickPoint.y === 'number') {
      var cursor = document.createElement('div');
      cursor.id = CURSOR_ID;
      cursor.setAttribute('data-toolsweb', 'highlight');
      cursor.style.position = 'fixed';
      cursor.style.left = clickPoint.x + 'px';
      cursor.style.top = clickPoint.y + 'px';
      // Tip of the arrow sits on the click point (not the SVG's top-left).
      cursor.style.width = '36px';
      cursor.style.height = '36px';
      cursor.style.margin = '0';
      cursor.style.transform = 'translate(-3px, -2px)';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '2147483647';
      cursor.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))';
      cursor.style.animation = 'toolsweb-cursor-pop 0.35s ease-out';
      cursor.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">'
        + '<path fill="#ef4444" stroke="#ffffff" stroke-width="1.35" stroke-linejoin="round" '
        + 'd="M5.2 3.2v16.2l4.3-4.3 2.4 5.7 2.5-1-2.4-5.7H19.5z"/>'
        + '</svg>';

      document.documentElement.appendChild(cursor);
    }
  }

  function waitForPaint() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          resolve(undefined);
        });
      });
    });
  }

  /** Mouse gestures keep red ring+cursor; keyboard/focus uses green. */
  function highlightKind(payload) {
    if (payload && payload.clickPoint) return 'click';
    if (payload && payload.action === 'click') return 'click';
    if (payload && payload.action === 'select') return 'click';
    return 'focus';
  }

  /** Guarantee ring geometry so Node can paint even after listbox unmount. */
  function ensureHighlightGeometry(payload) {
    if (!payload.boundingBox && payload.clickPoint) {
      var cx = payload.clickPoint.x;
      var cy = payload.clickPoint.y;
      payload.boundingBox = {
        x: Math.max(0, cx - 28),
        y: Math.max(0, cy - 28),
        width: 56,
        height: 56,
      };
    }
    if (
      payload.boundingBox &&
      !payload.clickPoint &&
      (payload.action === 'click' || payload.action === 'select')
    ) {
      var box = payload.boundingBox;
      payload.clickPoint = {
        x: box.x + box.width / 2,
        y: box.y + Math.min(24, box.height / 2),
      };
    }
    return payload;
  }

  /**
   * Deliver to Node. Freeze awaits the screenshot; other actions return immediately
   * so rapid typing/clicks are not lost while the shot queue drains (UC-0002).
   */
  /**
   * Always enqueue in-page (survives binding failures on some hosts).
   * Freeze waits for Node ack via __toolswebFreezeAck (UC-0002 / bridge Playwright).
   */
  function waitFreezeAck(freezeId, timeoutMs) {
    return new Promise(function (resolve) {
      var start = Date.now();
      function tick() {
        if (w.__toolswebFreezeAck === freezeId) {
          resolve(undefined);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          console.warn('[toolsweb] freeze ack timeout', freezeId);
          resolve(undefined);
          return;
        }
        setTimeout(tick, 40);
      }
      tick();
    });
  }

  function emit(payload) {
    // Stamp the gesture before any await — timeline source of truth for the prompt.
    if (!payload.capturedAt) {
      payload.capturedAt = new Date().toISOString();
    }
    ensureHighlightGeometry(payload);
    if (payload.boundingBox) {
      showHighlight(
        payload.boundingBox,
        payload.clickPoint || null,
        highlightKind(payload)
      );
    }

    w.__toolswebQueue = Array.isArray(w.__toolswebQueue) ? w.__toolswebQueue : [];
    w.__toolswebQueue.push(payload);

    if (payload.freezeNavigation) {
      var freezeId =
        'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      payload.freezeId = freezeId;
      var bindingPromise = Promise.resolve();
      if (typeof w.__toolswebCapture === 'function') {
        bindingPromise = waitForPaint().then(function () {
          return w.__toolswebCapture(payload);
        });
      }
      return bindingPromise.then(
        function () {
          return waitFreezeAck(freezeId, 8000);
        },
        function () {
          return waitFreezeAck(freezeId, 8000);
        }
      );
    }

    if (typeof w.__toolswebCapture === 'function') {
      void waitForPaint().then(function () {
        return w.__toolswebCapture(payload);
      });
    }
    return Promise.resolve();
  }

  // Allow Node to force-paint highlight right before the screenshot (avoids off-by-one frame).
  w.__toolswebPaintHighlight = function (payload) {
    if (!payload) return;
    ensureHighlightGeometry(payload);
    if (!payload.boundingBox) return;
    showHighlight(
      payload.boundingBox,
      payload.clickPoint || null,
      highlightKind(payload)
    );
  };
  w.__toolswebClearHighlight = clearHighlight;

  function eventElement(event) {
    var t = event.target;
    if (typeof event.composedPath === 'function') {
      var path = event.composedPath();
      var i;
      for (i = 0; i < path.length; i++) {
        if (path[i] && path[i].nodeType === 1) {
          t = path[i];
          break;
        }
      }
    }
    if (t && t.nodeType === 3) t = t.parentElement;
    return t;
  }

  function describeClick(el, selector) {
    var label =
      el.getAttribute('aria-label') ||
      el.value ||
      visibleText(el) ||
      selector;
    return 'Click on ' + el.tagName.toLowerCase() + ': ' + String(label).slice(0, 80);
  }

  function describeInput(el, selector) {
    var name =
      el.getAttribute('aria-label') ||
      el.getAttribute('name') ||
      el.getAttribute('placeholder') ||
      selector;
    return 'Type into ' + el.tagName.toLowerCase() + ': ' + String(name).slice(0, 80);
  }

  function describeSelect(el, selector) {
    var name =
      el.getAttribute('aria-label') ||
      el.getAttribute('name') ||
      visibleText(el) ||
      selector;
    return 'Select in ' + el.tagName.toLowerCase() + ': ' + String(name).slice(0, 80);
  }

  function describeFocus(el, selector) {
    var name =
      el.getAttribute('aria-label') ||
      el.getAttribute('name') ||
      el.getAttribute('placeholder') ||
      visibleText(el) ||
      selector;
    return 'Focus on ' + el.tagName.toLowerCase() + ': ' + String(name).slice(0, 80);
  }

  function describeOpenMenu(el, selector) {
    var name =
      el.getAttribute('aria-label') ||
      visibleText(el) ||
      selector;
    return 'Open menu: ' + String(name).slice(0, 80);
  }

  function isMenuOpener(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(
      'select, summary, [role="combobox"], ' +
        '[aria-haspopup="listbox"], [aria-haspopup="menu"], [aria-haspopup="true"]'
    );
  }

  function findOpenOverlay(nearEl) {
    var nodes = document.querySelectorAll(
      '[role="listbox"], [role="menu"], [role="tree"], [role="listbox"] [role="option"]'
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') continue;
      var box = getBoundingBox(n);
      if (box && box.width > 2 && box.height > 2) return n;
    }
    if (nearEl && nearEl.getAttribute && nearEl.getAttribute('aria-expanded') === 'true') {
      return nearEl;
    }
    return null;
  }

  function scheduleOpenMenuCapture(opener) {
    window.setTimeout(function () {
      try {
        var overlay = findOpenOverlay(opener);
        var expanded =
          (opener.getAttribute && opener.getAttribute('aria-expanded') === 'true') ||
          !!(opener.closest && opener.closest('[aria-expanded="true"]'));
        if (!overlay && !expanded) return;
        var target = overlay || opener;
        var selector = buildSelector(target);
        var boundingBox = getBoundingBox(target) || getBoundingBox(opener);
        var clickPoint = boundingBox
          ? {
              x: boundingBox.x + boundingBox.width / 2,
              y: boundingBox.y + Math.min(24, boundingBox.height / 2),
            }
          : null;
        var payload = applyMetadata({
          action: 'click',
          tagName: target.tagName.toLowerCase(),
          selector: selector,
          url: location.href,
          description: describeOpenMenu(opener, selector),
          freezeNavigation: false,
        }, target);
        var text = visibleText(target);
        if (text) payload.text = text;
        if (boundingBox) payload.boundingBox = boundingBox;
        if (clickPoint) payload.clickPoint = clickPoint;
        void emit(payload);
      } catch (e) { /* ignore */ }
    }, 250);
  }

  function replayClick(target) {
    w.__toolswebIgnoreClick = true;
    try {
      if (typeof target.click === 'function') {
        target.click();
      } else {
        target.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
        );
      }
    } finally {
      // Allow the next real user gesture soon after native activation.
      setTimeout(function () {
        w.__toolswebIgnoreClick = false;
      }, 0);
    }
  }

  /** Vertical/horizontal scrollbar thumbs & tracks — never intercept (breaks menu scroll). */
  function isScrollbarClick(event) {
    var el = event.target;
    if (!el || el.nodeType !== 1) return false;
    var node = el;
    while (node && node.nodeType === 1) {
      var overflowY = '';
      var overflowX = '';
      try {
        var cs = window.getComputedStyle(node);
        overflowY = cs.overflowY;
        overflowX = cs.overflowX;
      } catch (e) {
        break;
      }
      var canScrollY =
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        node.scrollHeight > node.clientHeight + 1;
      var canScrollX =
        (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
        node.scrollWidth > node.clientWidth + 1;
      if (canScrollY || canScrollX) {
        var rect = node.getBoundingClientRect();
        var barY = node.offsetWidth - node.clientWidth;
        var barX = node.offsetHeight - node.clientHeight;
        if (canScrollY && barY > 0 && event.clientX >= rect.left + node.clientWidth - 1) {
          return true;
        }
        if (canScrollX && barX > 0 && event.clientY >= rect.top + node.clientHeight - 1) {
          return true;
        }
      }
      if (node === document.documentElement || node === document.body) break;
      node = node.parentElement;
    }
    return false;
  }

  /**
   * Freeze clicks that may navigate / change the main view before the shot.
   * Never freeze form fields or list widgets — freeze breaks focus, typing and dropdowns.
   */
  function shouldFreezeForScreenshot(target) {
    if (!target || !target.closest) return false;
    if (
      target.closest(
        'input, textarea, select, option, label, ' +
          '[contenteditable="true"], [contenteditable=""], ' +
          '[role="textbox"], [role="searchbox"], [role="combobox"], ' +
          '[role="listbox"], [role="option"], [role="menu"], [role="menuitem"], ' +
          '[role="menuitemradio"], [role="menuitemcheckbox"], ' +
          '[role="tree"], [role="treeitem"], ' +
          '[aria-haspopup="listbox"], [aria-haspopup="menu"], [aria-haspopup="true"]'
      )
    ) {
      return false;
    }
    return true;
  }

  function buildInteractionPayload(target, clientX, clientY) {
    if (!target || target.nodeType !== 1) return null;
    if (target.id === HIGHLIGHT_ID || target.id === CURSOR_ID) return null;
    if (target.closest && target.closest('[data-toolsweb="highlight"]')) return null;
    if (isToolswebChrome(target)) return null;
    if (target.closest && target.closest('select, option')) return null;

    var optionLike =
      target.closest &&
      target.closest(
        '[role="option"], [role="menuitem"], [role="menuitemradio"], ' +
          '[role="menuitemcheckbox"], [role="treeitem"]'
      );
    var highlightEl = optionLike || target;
    var selector = buildSelector(highlightEl);
    var boundingBox = getBoundingBox(highlightEl) || getBoundingBox(target);
    var text = visibleText(highlightEl) || visibleText(target);
    var freeze = shouldFreezeForScreenshot(target);
    var action = optionLike ? 'select' : 'click';
    var opener = isMenuOpener(target);
    var payload = applyMetadata({
      action: action,
      tagName: highlightEl.tagName.toLowerCase(),
      selector: selector,
      url: location.href,
      description: optionLike
        ? describeSelect(highlightEl, selector)
        : opener
          ? describeOpenMenu(target, selector)
          : describeClick(target, selector),
      clickPoint: { x: clientX, y: clientY },
      freezeNavigation: freeze && action === 'click',
    }, highlightEl);
    if (text) payload.text = text;
    if (boundingBox) payload.boundingBox = boundingBox;
    payload.__opener = opener;
    payload.__optionLike = !!optionLike;
    payload.__freezeTarget = target;
    return payload;
  }

  var lastGestureKey = '';
  var lastGestureAt = 0;
  var capturedPointers = {};

  function gestureDedupeKey(payload) {
    var cp = payload.clickPoint || {};
    return (
      payload.action +
      '|' +
      payload.selector +
      '|' +
      Math.round(cp.x || 0) +
      '|' +
      Math.round(cp.y || 0)
    );
  }

  function isDuplicateGesture(payload) {
    var key = gestureDedupeKey(payload);
    var now = Date.now();
    if (key === lastGestureKey && now - lastGestureAt < 450) return true;
    lastGestureKey = key;
    lastGestureAt = now;
    return false;
  }

  // Capture on pointerdown FIRST — listbox options often unmount before click.
  document.addEventListener(
    'pointerdown',
    function (event) {
      if (w.__toolswebIgnoreClick) return;
      if (event.button !== 0) return;
      var target = eventElement(event);
      if (!target) return;
      if (isScrollbarClick(event)) return;

      var payload = buildInteractionPayload(target, event.clientX, event.clientY);
      if (!payload) return;

      // Freeze navigations stay on click (need preventDefault there).
      if (payload.freezeNavigation) return;

      if (isDuplicateGesture(payload)) return;
      capturedPointers[event.pointerId] = true;
      var opener = payload.__opener;
      var optionLike = payload.__optionLike;
      delete payload.__opener;
      delete payload.__optionLike;
      delete payload.__freezeTarget;
      void emit(payload);
      if (!optionLike && opener) {
        scheduleOpenMenuCapture(target);
      }
    },
    listenerOpts
  );

  document.addEventListener(
    'click',
    function (event) {
      if (w.__toolswebIgnoreClick) return;
      var target = eventElement(event);
      if (!target) return;
      if (isScrollbarClick(event)) return;

      var payload = buildInteractionPayload(target, event.clientX, event.clientY);
      if (!payload) return;

      var already =
        typeof event.pointerId === 'number' && capturedPointers[event.pointerId];
      if (already) {
        delete capturedPointers[event.pointerId];
      }

      // Non-freeze already handled on pointerdown (unless missed).
      if (!payload.freezeNavigation) {
        if (already) return;
        if (isDuplicateGesture(payload)) return;
        var opener2 = payload.__opener;
        var optionLike2 = payload.__optionLike;
        delete payload.__opener;
        delete payload.__optionLike;
        delete payload.__freezeTarget;
        void emit(payload);
        if (!optionLike2 && opener2) {
          scheduleOpenMenuCapture(target);
        }
        return;
      }

      delete payload.__opener;
      delete payload.__optionLike;
      var freezeTarget = payload.__freezeTarget || target;
      delete payload.__freezeTarget;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      emit(payload).then(function () {
        replayClick(freezeTarget);
      });
    },
    listenerOpts
  );

  var inputTimer = null;
  var lastInputKey = '';

  function selectedLabel(el) {
    try {
      if (el.tagName === 'SELECT' && el.selectedOptions && el.selectedOptions[0]) {
        return String(el.selectedOptions[0].textContent || el.value || '').trim();
      }
    } catch (e) { /* ignore */ }
    return String(el.value || '').trim();
  }

  function flushFieldCapture(target, eventType) {
    if (!target) return;
    var tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

    var isPassword = tag === 'INPUT' && String(target.type || '').toLowerCase() === 'password';
    var selector = buildSelector(target);
    var value = isPassword
      ? '••••••'
      : (tag === 'SELECT' ? selectedLabel(target) : String(target.value || '')).slice(0, 200);
    var key = selector + '::' + value;
    // Coalesce noisy input events; always keep change/blur so each option picks a step.
    if (key === lastInputKey && eventType === 'input') return;

    lastInputKey = key;
    var boundingBox = getBoundingBox(target);
    var isSelect = tag === 'SELECT';
    var payload = applyMetadata({
      action: isSelect ? 'select' : 'input',
      tagName: target.tagName.toLowerCase(),
      selector: selector,
      value: value,
      url: location.href,
      description: isSelect
        ? describeSelect(target, selector)
        : describeInput(target, selector),
    }, target);
    if (!isPassword && value) payload.text = value;
    if (boundingBox) {
      payload.boundingBox = boundingBox;
      if (isSelect) {
        payload.clickPoint = {
          x: boundingBox.x + boundingBox.width / 2,
          y: boundingBox.y + Math.min(24, boundingBox.height / 2),
        };
      }
    }
    emit(payload);
  }

  function onFieldEvent(event) {
    var target = eventElement(event) || event.target;
    if (!target) return;
    var tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

    if (inputTimer) window.clearTimeout(inputTimer);
    var delay = event.type === 'change' || event.type === 'blur' ? 0 : 150;
    inputTimer = window.setTimeout(function () {
      flushFieldCapture(target, event.type);
    }, delay);
  }

  var lastFocusKey = '';

  function isFocusCaptureTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (!el.getAttribute) return false;
    var role = String(el.getAttribute('role') || '').toLowerCase();
    return (
      role === 'textbox' ||
      role === 'searchbox' ||
      role === 'combobox' ||
      role === 'listbox' ||
      el.isContentEditable === true
    );
  }

  document.addEventListener(
    'focusin',
    function (event) {
      var target = eventElement(event) || event.target;
      if (!isFocusCaptureTarget(target)) return;
      if (isToolswebChrome(target)) return;
      var selector = buildSelector(target);
      if (selector === lastFocusKey) return;
      lastFocusKey = selector;
      var boundingBox = getBoundingBox(target);
      var payload = applyMetadata({
        action: 'input',
        tagName: target.tagName.toLowerCase(),
        selector: selector,
        url: location.href,
        description: describeFocus(target, selector),
        freezeNavigation: false,
      }, target);
      var text = visibleText(target);
      if (text) payload.text = text;
      if (boundingBox) payload.boundingBox = boundingBox;
      void emit(payload);
    },
    listenerOpts
  );

  document.addEventListener('input', onFieldEvent, listenerOpts);
  document.addEventListener('change', onFieldEvent, listenerOpts);
  document.addEventListener('blur', onFieldEvent, listenerOpts);

  // Mark installed only after listeners are attached (avoids half-broken sessions).
  w.__toolswebInstalled = true;
  w.__toolswebListenersOk = true;
})();
`;
}

/** @deprecated Prefer buildCaptureInitScript({ enableAvatarScript }) — kept for smoke scripts. */
export const CAPTURE_INIT_SCRIPT = buildCaptureInitScript({ enableAvatarScript: true });
