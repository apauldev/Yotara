/**
 * Stable key for case/whitespace-insensitive label uniqueness.
 *
 * Normalization composes canonically equivalent forms before and after
 * lowercasing. The first NFKC pass composes input such as `É` and `E` plus a
 * combining accent; lowercasing handles Unicode case variants; the second pass
 * recomposes sequences that only become composable once lowercased — for
 * example `T` plus a combining diaeresis collapses to `ẗ`, and Greek `Ϊ` plus a
 * combining tonos to `ΐ`. Without the second pass those forms would get
 * distinct keys and coexist.
 *
 * The second pass is NFD followed by NFKC so the Greek ypogegrammeni (iota
 * subscript, U+0345) can be folded in between. NFKC prefers precomposed
 * characters, so the subscript appears both as a combining mark and inside
 * forms such as `ᾳ`; decomposing first lets both spellings fold to `ι`, as
 * Unicode full case folding requires (`ᾳ` and `αι` share a key). The round trip
 * is otherwise identical for every other sequence.
 *
 * The overrides apply Unicode case *folding* for the characters where
 * lowercase mapping and case folding differ (CaseFolding.txt): `ß`/`ẞ` fold to
 * `ss`, final sigma `ς` folds to medial `σ`, long s `ſ` folds to `s`, the iota
 * subscript folds to `ι`, and the Cyrillic Extended-C variants (U+1C80–U+1C88)
 * fold to their base letters. JavaScript's toLowerCase() implements case
 * conversion only, so without these replacements `ΟΣ` and `οσ` (or `Straße`
 * and `STRASSE`) would produce distinct keys and both labels could coexist.
 * Cherokee is the one known remaining divergence: CaseFolding.txt folds it to
 * uppercase, which is immaterial for label names.
 *
 * SQLite's built-in lower() is ASCII-only, so this must be computed in
 * application code.
 */
const CYRILLIC_EXTENDED_C_FOLDS: Record<string, string> = {
  '\u1C80': '\u0432',
  '\u1C81': '\u0434',
  '\u1C82': '\u043E',
  '\u1C83': '\u0441',
  '\u1C84': '\u0442',
  '\u1C85': '\u0442',
  '\u1C86': '\u044A',
  '\u1C87': '\u0463',
  '\u1C88': '\uA64B',
};

export function labelNameKey(name: string): string {
  return name
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replaceAll('\u0345', '\u03B9')
    .normalize('NFKC')
    .replaceAll('ß', 'ss')
    .replaceAll('ς', 'σ')
    .replaceAll('ſ', 's')
    .replace(/[\u1C80-\u1C88]/g, (char) => CYRILLIC_EXTENDED_C_FOLDS[char] ?? char);
}
