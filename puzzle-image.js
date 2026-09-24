/** Neutral paper rendering stays readable when shared between different themes/devices. */
export function puzzleCanvas(board, { title = 'Sudoku', document: doc = document } = {}) {
    if (typeof board !== 'string' || !/^[0-9]{81}$/.test(board)) throw new Error('Export needs an 81-cell grid.');
    const canvas = doc.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1200;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export is unavailable in this browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111111';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'bold 34px sans-serif';
    context.fillText(title, 540, 65, 960);
    const left = 54, top = 144, cell = 108;
    context.font = '54px sans-serif';
    for (let i = 0; i < 81; i++) {
        if (board[i] !== '0') context.fillText(board[i], left + (i % 9 + 0.5) * cell, top + (Math.floor(i / 9) + 0.5) * cell);
    }
    for (let line = 0; line <= 9; line++) {
        context.strokeStyle = line % 3 ? '#777777' : '#111111';
        context.lineWidth = line % 3 ? 2 : 6;
        context.beginPath();
        context.moveTo(left + line * cell, top);
        context.lineTo(left + line * cell, top + 9 * cell);
        context.moveTo(left, top + line * cell);
        context.lineTo(left + 9 * cell, top + line * cell);
        context.stroke();
    }
    return canvas;
}

export async function downloadPuzzleImage(board, options = {}) {
    const canvas = puzzleCanvas(board, options);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not create the image.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sudoku.png';
    document.body.append(link);
    link.click();
    link.remove();
    // Safari may consume the URL after click dispatch returns.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
