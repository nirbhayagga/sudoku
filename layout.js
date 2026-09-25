/** Fit a board against natural page height, independent of motion preferences.
 * Measuring a viewport-height body counts empty space as controls. Measuring
 * during transitions also makes setup folding depend on animation timing.
 * The measuring class removes both influences for this synchronous pass.
 */
export function fitToViewport({ reset, maximum, setSize, minimum }) {
    document.body.classList.add('measuring-layout');
    try {
        reset();
        const max = Math.floor(maximum());
        if (!max) return { size: 0, atMax: true }; // jsdom / a hidden board
        const viewport = window.visualViewport?.height || window.innerHeight;
        const fits = size => {
            setSize(size);
            return document.body.getBoundingClientRect().height <= viewport - 8;
        };
        let low = Math.min(minimum, max), high = max, best = low;
        while (low <= high) {
            const candidate = Math.floor((low + high) / 2);
            if (fits(candidate)) { best = candidate; low = candidate + 1; }
            else high = candidate - 1;
        }
        setSize(best);
        return { size: best, atMax: best === max };
    } finally {
        document.body.classList.remove('measuring-layout');
    }
}
