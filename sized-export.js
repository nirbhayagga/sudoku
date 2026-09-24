import { validBoard, formatSizedPuzzle } from './geometry.js';
export function sizedLink(origin, puzzle, g) {
    if (!validBoard(puzzle, g)) throw new Error('Invalid puzzle');
    const url = new URL(origin); url.search = ''; url.hash = '';
    url.searchParams.set('size', g.size); url.searchParams.set('box', `${g.boxRows}x${g.boxCols}`); url.searchParams.set('p', puzzle);
    return url.toString();
}
export function parseSizedLink(search, geometries) {
    const p = new URLSearchParams(search), g = geometries[p.get('size')];
    if (!g || p.get('box') !== `${g.boxRows}x${g.boxCols}` || !validBoard(p.get('p'), g)) return null;
    return { g, puzzle: p.get('p') };
}
export function sizedSheet(puzzles, g, perPage = 4, answers = false) {
    if (![1, 2, 4, 6].includes(perPage) || !puzzles.length || puzzles.length > 24 || puzzles.some(p => !validBoard(p, g))) throw new Error('Invalid worksheet');
    const pages = [];
    for (let i = 0; i < puzzles.length; i += perPage) pages.push(`<section class="sheet">${puzzles.slice(i, i + perPage).map((p, j) => `<article><h2>${g.size}×${g.size} ${answers ? 'Answer' : 'Puzzle'} ${i + j + 1}</h2><table>${Array.from({ length: g.size }, (_, r) => `<tr>${Array.from({ length: g.size }, (_, c) => `<td style="border-right-width:${(c + 1) % g.boxCols ? 1 : 2}px;border-bottom-width:${(r + 1) % g.boxRows ? 1 : 2}px">${p[r * g.size + c] === '0' ? '' : p[r * g.size + c]}</td>`).join('')}</tr>`).join('')}</table></article>`).join('')}</section>`);
    return pages.join('');
}
export const SIZED_PRINT_CSS = `@page{margin:12mm}body{font:14px system-ui;color:#000;background:#fff}.sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:12mm;break-after:page}.sheet:last-child{break-after:auto}article{break-inside:avoid}h2{font-size:14px;font-weight:500}table{border-collapse:collapse;border:2px solid;width:100%;table-layout:fixed}td{border:1px solid;text-align:center;aspect-ratio:1;padding:8px 0;font-size:18px}.sheet:has(article:only-child){grid-template-columns:1fr;max-width:150mm}`;
export async function sizedPng(puzzle, g, document) {
    if (!validBoard(puzzle, g)) throw new Error('Invalid puzzle');
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1020;
    const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 900, 1020); c.fillStyle = '#171717';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '36px sans-serif'; c.fillText(`${g.size} × ${g.size} Sudoku`, 450, 60);
    const width = 780 / g.size;
    for (let i = 0; i <= g.size; i++) for (const vertical of [true, false]) {
        c.beginPath(); c.lineWidth = i % (vertical ? g.boxCols : g.boxRows) === 0 ? 4 : 1;
        c.moveTo(vertical ? 60 + i * width : 60, vertical ? 130 : 130 + i * width);
        c.lineTo(vertical ? 60 + i * width : 840, vertical ? 910 : 130 + i * width); c.stroke();
    }
    c.font = `${width * .48}px sans-serif`;
    [...puzzle].forEach((d, i) => { if (d !== '0') c.fillText(d, 60 + (i % g.size + .5) * width, 130 + (Math.floor(i / g.size) + .5) * width); });
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed')), 'image/png'));
}
export { formatSizedPuzzle };
