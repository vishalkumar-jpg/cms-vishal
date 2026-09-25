/** Simple fuzzy match: returns score > 0 when query matches label (substring or subsequence). */
export const fuzzyScore = (label: string, query: string): number => {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const t = label.toLowerCase();
  if (t.includes(q)) return 2 + q.length / t.length;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 0.5 + qi / t.length : 0;
};
