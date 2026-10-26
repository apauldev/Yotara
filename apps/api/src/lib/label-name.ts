/**
 * Stable key for case/whitespace-insensitive label uniqueness.
 *
 * Normalization wraps the lowercase mapping on both sides (NFKC, lowercase,
 * NFKC): the first pass composes canonically equivalent forms (for example,
 * `É` and `E` plus a combining accent), lowercasing handles Unicode case
 * variants, and the second pass recomposes sequences that only become
 * composable once lowercased — for example `T` plus a combining diaeresis
 * collapses to `ẗ`, and Greek `Ϊ` plus a combining tonos to `ΐ`. Without the
 * second pass those forms would get distinct keys and coexist.
 *
 * The final replace() pass applies Unicode case *folding* for the small set of
 * characters where lowercase mapping and case folding differ (CaseFolding.txt):
 * `ß`/`ẞ` fold to `ss`, final sigma `ς` folds to medial `σ`, and long s `ſ`
 * folds to `s`. JavaScript's toLowerCase() implements case conversion only, so
 * without the pass `ΟΣ` and `οσ` (or `Straße` and `STRASSE`) would produce
 * distinct keys and both labels could coexist. The replacements are already
 * NFKC-stable, so no further normalization is needed after them.
 *
 * SQLite's built-in lower() is ASCII-only, so this must be computed in
 * application code.
 */
export function labelNameKey(name: string): string {
  return name
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replaceAll('ß', 'ss')
    .replaceAll('ς', 'σ')
    .replaceAll('ſ', 's');
}
