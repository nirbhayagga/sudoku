/** Shared dialog focus, background isolation and scroll preservation. */
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function isFocusVisible(el) {
    if (el.disabled || el.hidden || el.tabIndex < 0) return false;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
        const style = window.getComputedStyle(node);
        if (node.hidden || node.inert || style.display === 'none' || style.visibility === 'hidden') return false;
        if (node.matches('details:not([open])')) {
            const summary = node.querySelector(':scope > summary');
            if (!summary?.contains(el)) return false;
        }
    }
    return true;
}

function focusableIn(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(isFocusVisible);
}

export function createDialogs(pageRegions = [], { onOpen = () => {}, onClosed = () => {} } = {}) {
    let active = null;

    function open(overlay, { initialFocus, onClose = () => {} } = {}) {
        if (active?.overlay === overlay) return;
        if (active) close(active.overlay);
        onOpen();
        const scroll = { x: window.scrollX, y: window.scrollY, top: document.body.style.top };
        const regions = pageRegions.map(region => ({ region, aria: region.getAttribute('aria-hidden'), inert: region.inert }));
        active = { overlay, returnFocusTo: document.activeElement, onClose, scroll, regions };
        // Fixed positioning also prevents background touch scrolling on iOS.
        document.body.style.top = `-${scroll.y}px`;
        document.body.classList.add('dialog-open');
        overlay.classList.add('active');
        for (const { region } of regions) { region.inert = true; region.setAttribute('aria-hidden', 'true'); }
        overlay.querySelector('.modal-body')?.scrollTo?.(0, 0);
        const target = initialFocus || focusableIn(overlay)[0];
        target?.focus({ preventScroll: true });
    }

    function close(overlay) {
        overlay.classList.remove('active');
        if (active?.overlay !== overlay) return;
        const { returnFocusTo, onClose, scroll, regions } = active;
        active = null;
        for (const { region, aria, inert } of regions) {
            region.inert = inert;
            if (aria === null) region.removeAttribute('aria-hidden');
            else region.setAttribute('aria-hidden', aria);
        }
        document.body.classList.remove('dialog-open');
        document.body.style.top = scroll.top;
        window.scrollTo(scroll.x, scroll.y);
        onClose();
        if (returnFocusTo && document.contains(returnFocusTo) && isFocusVisible(returnFocusTo)) {
            returnFocusTo.focus({ preventScroll: true });
        }
        onClosed();
    }

    function handleKeydown(e) {
        if (!active) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close(active.overlay);
        } else if (e.key === 'Tab') {
            // Own the whole cycle: native tabbing can leave a clipped dialog,
            // and closed details must not contribute invisible endpoints.
            const items = focusableIn(active.overlay);
            e.preventDefault();
            if (!items.length) return;
            const index = items.indexOf(document.activeElement);
            const next = index < 0 ? (e.shiftKey ? items.length - 1 : 0)
                : (index + (e.shiftKey ? -1 : 1) + items.length) % items.length;
            items[next].focus();
        }
    }
    document.addEventListener('keydown', handleKeydown, true);
    return { open, close, isOpen: () => active !== null };
}
