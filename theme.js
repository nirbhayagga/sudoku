/**
 * Theme switching.
 *
 * Themes are pure CSS: each is a [data-theme="..."] block in style.css that
 * overrides the same custom properties. This module only sets the attribute,
 * keeps the dropdown's active state in step, and updates the theme-color meta
 * tag so mobile browser chrome matches the page.
 *
 * Adding a theme therefore means: a variable block in style.css, a button with
 * a swatch in index.html, an entry in THEME_COLORS below, and a measured row in
 * CONTROL_SURFACES in scripts/check-contrast.js.
 *
 * With nothing saved, the theme follows the system colour scheme — light or
 * dark — which is what people expect of an app that has both. A saved choice
 * always wins. The same rule runs inline in index.html before first paint so
 * neither a saved nor a system theme flashes the :root defaults; that script
 * and this module must agree.
 */
import { setTheme, clearTheme } from './storage.js';

/** The theme the system asks for, when nothing has been chosen. */
export function systemTheme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

/** Background colour per theme, mirrored into <meta name="theme-color">. */
export const THEME_COLORS = {
    light: '#f4f5f7',
    dark: '#121316',
    midnight: '#0a0a0f',
    sakura: '#f5e1d8',
    ocean: '#0b1628',
    forest: '#091209',
    arctic: '#dce4ef',
    peony: '#fff7e6',
    matcha: '#e9e1d7',
    vino: '#2a0e13',
};

/**
 * Apply a selection and optionally remember it. System (including unknown
 * names) clears the preference so future OS changes remain effective.
 * Dropdown state describes the selection, while the return value describes
 * the concrete light/dark theme rendered for System.
 *
 * @param {string} theme
 * @param {{dropdown?: Element, persist?: boolean}} [options]
 */
export function applyTheme(theme, { dropdown, persist = true } = {}) {
    const selection = Object.hasOwn(THEME_COLORS, theme) ? theme : 'system';
    const name = selection === 'system' ? systemTheme() : selection;

    // Always set, even for midnight, whose values live on :root and would apply
    // without it — an unknown name is what must never be left standing.
    document.documentElement.setAttribute('data-theme', name);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[name]);

    if (dropdown) {
        dropdown.querySelectorAll('.theme-option').forEach((option) => {
            const active = option.dataset.theme === selection;
            option.classList.toggle('active', active);
            option.setAttribute('aria-pressed', String(active));
        });
    }

    if (persist) {
        if (selection === 'system') clearTheme();
        else setTheme(selection);
    }
    return name;
}
