/**
 * Shared accessibility behaviour for the app's overlays.
 *
 * Every dialog goes through here so they all behave alike: Escape closes, Tab
 * is confined to the dialog, focus moves in on open and returns to whatever
 * opened it, and the page behind is hidden from assistive technology. Without
 * the trap, Tab walks into the grid behind the overlay — invisible to a sighted
 * user and incoherent to a screen reader.
 *
 * The overlays must be siblings of the hidden regions, never descendants, or
 * focus would end up inside an aria-hidden subtree.
 */

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Visible in the sense that matters for focus.
 *
 * Deliberately checks inline `display:none` up the ancestor chain rather than
 * offsetParent or getClientRects: that is how this app hides things (the win
 * screen's submit block, for one), and it works without layout — which jsdom
 * does not have, so the usual checks would report everything as hidden there.
 */
function isFocusVisible(el) {
    if (el.disabled || el.hidden) return false;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
        if (node.style && node.style.display === 'none') return false;
    }
    return true;
}

function focusableIn(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(isFocusVisible);
}

/**
 * @param {Element[]} pageRegions Regions to hide from assistive tech while a
 *   dialog is open.
 */
export function createDialogs(pageRegions = []) {
    let active = null;

    function open(overlay, { initialFocus } = {}) {
        if (active && active.overlay !== overlay) close(active.overlay);

        active = { overlay, returnFocusTo: document.activeElement };
        overlay.classList.add('active');
        for (const region of pageRegions) region.setAttribute('aria-hidden', 'true');

        const target = initialFocus || focusableIn(overlay)[0];
        if (target) target.focus();
    }

    function close(overlay) {
        overlay.classList.remove('active');
        for (const region of pageRegions) region.removeAttribute('aria-hidden');

        if (active && active.overlay === overlay) {
            const { returnFocusTo } = active;
            active = null;
            // Put focus back where it came from, rather than dropping a
            // keyboard user at the top of the document.
            if (returnFocusTo && document.contains(returnFocusTo) && isFocusVisible(returnFocusTo)) {
                returnFocusTo.focus();
            }
        }
    }

    const isOpen = () => active !== null;

    function handleKeydown(e) {
        if (!active) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            // Escape also resets the puzzle from the cell handler, so the
            // dialog has to win. Registered in the capture phase for the same
            // reason.
            e.stopPropagation();
            close(active.overlay);
            return;
        }

        if (e.key !== 'Tab') return;

        const focusable = focusableIn(active.overlay);
        if (focusable.length === 0) {
            e.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;
        const escaped = !active.overlay.contains(current);

        // Wrap at both ends, and pull focus back in if it got out.
        if (e.shiftKey && (current === first || escaped)) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && (current === last || escaped)) {
            e.preventDefault();
            first.focus();
        }
    }

    document.addEventListener('keydown', handleKeydown, true);

    return { open, close, isOpen };
}
