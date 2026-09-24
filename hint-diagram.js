/** Candidate-level evidence without consulting the solved board. */
export function createHintDiagram(step, document) {
    const figure = document.createElement('figure');
    figure.className = 'hint-diagram';
    const caption = document.createElement('figcaption');
    caption.textContent = 'Candidate map: outlined cells support this step; × marks exclusions, ● marks the placement.';
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 450 450');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${step.type.replaceAll('-', ' ')} candidate map. ${step.nudge || step.reason}`);
    const evidence = new Map((step.premises || []).map(p => [p.cell, p]));
    const removals = new Set((step.removals || []).map(r => `${r.cell}:${r.digit}`));
    for (let cell = 0; cell < 81; cell++) {
        const x = cell % 9 * 50, y = Math.floor(cell / 9) * 50;
        const rect = document.createElementNS(ns, 'rect');
        for (const [key, value] of Object.entries({ x, y, width: 50, height: 50 })) rect.setAttribute(key, value);
        rect.setAttribute('class', evidence.has(cell) ? 'diagram-evidence' : 'diagram-cell'); svg.append(rect);
        const p = evidence.get(cell);
        if (!p) continue;
        for (const digit of p.candidates) {
            const text = document.createElementNS(ns, 'text');
            const d = Number(digit) - 1;
            text.setAttribute('x', x + 8 + d % 3 * 16);
            text.setAttribute('y', y + 12 + Math.floor(d / 3) * 16);
            const excluded = removals.has(`${cell}:${digit}`), placed = step.idx === cell && step.digit === digit;
            text.textContent = digit + (excluded ? '×' : placed ? '●' : '');
            if (excluded || placed) text.setAttribute('class', 'diagram-conclusion');
            svg.append(text);
        }
    }
    for (const value of [0, 150, 300, 450]) for (const vertical of [true, false]) {
        const line = document.createElementNS(ns, 'line');
        const attrs = vertical ? { x1: value, x2: value, y1: 0, y2: 450 } : { x1: 0, x2: 450, y1: value, y2: value };
        for (const [key, v] of Object.entries(attrs)) line.setAttribute(key, v);
        line.setAttribute('class', 'diagram-box'); svg.append(line);
    }
    figure.append(caption, svg); return figure;
}
