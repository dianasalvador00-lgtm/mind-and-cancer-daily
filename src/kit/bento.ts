// Column spans for a bento grid of 6 columns. Rows are filled from a pattern; when fewer cards
// remain than a row holds, they share the row evenly (so there is no gap), unless fillLast is false.
export const TOP_ROWS = [[4, 2], [2, 2, 2], [3, 3], [2, 2, 2]];
export const PAIR_ROWS = [[3, 3]];
export const TILE_ROWS = [[2, 2, 2]];

const even = (k: number): number[] => (k === 1 ? [6] : k === 2 ? [3, 3] : [2, 2, 2]);

export function spans(n: number, rows: number[][] = TOP_ROWS, fillLast = true): number[] {
  const out: number[] = [];
  let r = 0;
  while (out.length < n) {
    const row = rows[r++ % rows.length];
    const left = n - out.length;
    if (left >= row.length) out.push(...row);
    else out.push(...(fillLast ? even(left) : row.slice(0, left)));
  }
  return out;
}
