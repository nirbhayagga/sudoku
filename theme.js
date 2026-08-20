/**
 * Theme switching.
 *
 * Themes are pure CSS: each is a [data-theme="..."] block in style.css that
 * overrides the same custom properties. This module only sets the attribute,
 * keeps the dropdown's active state in step, and updates the theme-color meta
 * tag so mobile browser chrome matches the page.
 *
 * Adding a theme therefore means three things: a variable block in style.css,
 * a button in index.html, and an entry in THEME_COLORS below.
 */
import { setTheme } from './storage.js';

export const DEFAULT_THEME = 'midnight';

/** Background colour per theme, mirrored into <meta name="theme-color">. */
export const THEME_COLORS = {
    midnight: '#0a0a0f',
    sakura: '#f5e1d8',
    ocean: '#0b1628',
    forest: '#091209',
    arctic: '#dce4ef',
    naruto: '#0f0800',
    wicked: '#050d08',
};

/**
 * Apply a theme and remember it.
 *
 * @param {string} theme
 * @param {{dropdown?: Element, persist?: boolean}} [options]
 */
export function applyTheme(theme, { dropdown, persist = true } = {}) {
    const name = THEME_COLORS[theme] ? theme : DEFAULT_THEME;

    // Midnight is the :root default, so it is expressed by the absence of the
    // attribute rather than by a block of its own.
    if (name !== DEFAULT_THEME) {
        document.documentElement.setAttribute('data-theme', name);
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[name]);

    if (dropdown) {
        dropdown.querySelectorAll('.theme-option').forEach((option) => {
            option.classList.toggle('active', option.dataset.theme === name);
        });
    }

    if (persist) setTheme(name);
    return name;
}
