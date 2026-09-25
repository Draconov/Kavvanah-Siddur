# Content and software notices

Kavvanah preserves edition metadata in every book and siddur JSON file. The reader's “Text editions & attribution” panel links to the source editions. Texts were imported from the [Sefaria public export](https://github.com/Sefaria/Sefaria-Export) using `scripts/import-texts.py` in September 2026.

## Text editions

| Material | Edition | Source-declared license |
| --- | --- | --- |
| Tanakh Hebrew | Tanach with Nikkud | Public Domain |
| Tanakh English | The Holy Scriptures: A New Translation (JPS 1917) | Public Domain |
| Russian Tanakh and exact biblical passages in the siddur | Russian Synodal Translation (1876), CrossWire RusSynodal 1.9.1 | Public Domain |
| Ukrainian Tanakh and exact biblical passages in the siddur | Ukrainian Freedom Bible, historical Kulish–Puluj translation, eBible revision 2025-02-05 | Public Domain |
| Ashkenaz Hebrew | The Metsudah siddur: a new linear siddur with English translation by Avrohom Davis, 1981; The Metsudah siddur, 1981 | CC-BY |
| Ashkenaz Hebrew fallback | Daat Siddur Ashkenaz | Public Domain |
| Ashkenaz English | Translation based on the Metsudah linear siddur, by Avrohom Davis, 1981 | CC-BY |
| Edot HaMizrach Hebrew | Torat Emet 357 | Public Domain |
| Edot HaMizrach English | Sefaria Community Translation | CC0 |

Attribution: Avrohom Davis / Metsudah for the identified siddur editions; Daat and Torat Emet for the identified Hebrew editions; the Jewish Publication Society for the 1917 Tanakh translation; Sefaria and its community contributors for distribution and community translations. The export labels CC-BY without a version; retain this source metadata when redistributing. [Sefaria's terms and copyright guidance](https://www.sefaria.org/terms).

Import changes: HTML formatting and inline editorial footnotes were removed for plain-text reading; source paragraph boundaries, prayer instructions, and edition alternatives remain. Where siddur editions have unequal paragraph counts, English is omitted rather than paired by position. Empty source placeholders are removed. Equal paragraph counts alone do not replace expert linguistic review.

The Tanakh has 929 chapters across 39 selectable volumes (the traditional 24 books are subdivided for navigation). Siddur content contains 445 Ashkenaz sections and 129 Edot sections; section counts are not counts of complete standalone prayers. English siddur translation coverage is partial. Russian and Ukrainian are present for all 23,206 displayed Hebrew verses: the original editions supply 23,204 Russian and 23,203 Ukrainian rows, and the five missing language entries are filled by the separately identified Kavvanah supplement. The current Ashkenaz corpus has Russian text for every displayed Hebrew paragraph; other siddur languages and traditions remain independently incomplete. Users can still save personal translations locally.

## Russian source and alignment

The [CrossWire RusSynodal module](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=RusSynodal) declares the 1876 Russian Synodal translation public domain. The bundled text comes from [scrollmapper's JSON export](https://github.com/scrollmapper/bible_databases/blob/master/formats/json/RusSynodal.json), SHA-256 `5fbf2ff04f3e87d0cc9ee465fd276f3a8727b4688cdbd8988b99312566b4978e`. Only the books and passages corresponding to Kavvanah's Hebrew canon are imported; the New Testament and additional books are excluded. This is a Christian-era Synodal translation, identified by edition in the reader, not a newly commissioned Jewish translation. Source wording and bracketed readings are preserved.

`scripts/import-public-translations.py` uses explicit source-to-Hebrew references from SIL's Russian Orthodox versification table, with the edition adjustments recorded in `scripts/versification/README.md`. It does not infer chapter equivalence from lengths. Chapter splits and joins, Psalm numbering, superscriptions, Daniel's additions, and the grouped commandments in the bundled Hebrew are handled explicitly. When one Russian source verse spans several Hebrew verses, its complete wording is repeated with a “Combined source passage” label. Many-to-one verses are joined in source order. Every Russian passage records its original reference in `translationRefs.ru`; the source importer leaves two omissions empty for the supplementary importer to fill separately. The importer rejects an unreviewed source revision or unexpected missing verse.

## Ukrainian source and alignment

[eBible's Ukrainian Freedom Bible](https://ebible.org/find/details.php?id=ukrfb) declares this edition public domain and identifies Panteleimon Kulish, Ivan Nechui-Levytsky, and Ivan Puluj as its translators/contributors. The imported [USFM archive](https://ebible.org/Scriptures/ukrfb_usfm.zip) has SHA-256 `8b287e873f9a11e645ca756690258b6abd6a9d6e967dd4bd1ea850262aacff5f`. Historical Ukrainian spelling is preserved. This is a historical Christian Bible translation; only books corresponding to the Hebrew canon are bundled. No New Testament text is included.

`scripts/import-ukrainian-translations.py` removes editorial footnotes and section headings, preserves original verse numbers, and maps explicit references using SIL's English and Russian Orthodox tables with the edition exceptions documented in `scripts/versification/README.md`. Superscriptions included in a source verse are preserved. A complete source passage spanning multiple Hebrew verses is repeated with the combined-passage label; source verses that split one Hebrew verse are joined in order. `translationRefs.uk` records every source reference. All source verses from the selected books are retained, and the importer rejects an unexpected missing Hebrew reference or unreviewed archive revision. The source importer leaves three omissions empty for the supplementary importer to fill separately.

## Kavvanah supplementary translations

The reader separately identifies **Kavvanah supplementary translations (2026)**. These additions are not attributed to CrossWire, eBible, Metsudah, or an unimported siddur publisher. The underlying Hebrew editions retain their attribution and licenses.

`scripts/translations/kavvanah-supplement.json` stores each addition beside its Hebrew source. `scripts/import-translation-supplement.py` matches that source, not paragraph position, and never replaces an existing published translation. New entries have `translationEditions` set to `kavvanah-supplement-2026` and a `KAV` reference. A regression digest protects every pre-existing Hebrew, English, Russian, and Ukrainian paragraph and its reference metadata.

The five Tanakh additions are Russian Psalm 142:1 and Song of Songs 1:1; Ukrainian Leviticus 21:24, Psalm 148:14, and Song of Songs 1:1. The source importers described above still leave these omissions empty; run the supplementary importer afterward to fill them. Its `--check` option verifies that the additions are applied; `--require-complete` reports any remaining Russian/Ukrainian gaps in the supplemented corpora. These additions are separate from the completed Ashkenaz Russian manifest described below and are not another publisher's complete siddur edition.

## Pronunciation and observance

Latin, Russian, and Ukrainian transliteration is computed with `hebrew-transliteration`. Cyrillic sounds are assigned to individual Hebrew phonemes before rendering, preserving bet/vet, kaf/khaf, pe/fe, and letter boundaries. Silent final he, mappiq, sheva, maqaf context, and divine-name abbreviations have regression tests. Unpointed or unsupported words are retained in Hebrew instead of assigning invented vowels or consonant sounds. Sephardi/Israeli and Ashkenazi reading aids are distinct from nusach. They have not undergone complete professional proofreading and do not encode every community pronunciation.

Seasonal inserts and alternatives follow the source; this release does not automatically decide which to recite. There is no separate High Holiday machzor or Nusach Sefard edition. Review text and calculation methods with the appropriate community authority before relying on the app for observance.

## Software and fonts

Kavvanah application code is distributed under GNU GPL version 2; see `LICENSE`. The bundled text editions and fonts retain their independent licenses. Dependency versions are pinned by `pnpm-lock.yaml`.

- [Hebcal core](https://github.com/hebcal/hebcal-es6), version 6.9.2, GPL-2.0: Hebrew calendar and zmanim. Its notices are retained in production JavaScript. [Documentation](https://hebcal.github.io/api/core/).
- [hebrew-transliteration](https://github.com/charlesLoder/hebrew-transliteration), version 2.11.0, MIT, and [havarotjs](https://github.com/charlesLoder/havarotjs), version 0.25.4, MIT: transliteration and Hebrew syllable analysis.
- React, Vinext, Next.js, Tailwind CSS, Base UI, Radix UI, and the shadcn components: respective upstream licenses and notices apply; consult their installed package licenses when redistributing dependencies.
- [Lucide](https://lucide.dev/license): ISC-licensed interface icons.
- DM Sans and Noto Serif Hebrew: SIL Open Font License 1.1. Font notices are included with the bundled fonts. Fonts are served locally.

The app requires no paid API at runtime. Texts are bundled; date, solar, bearing, and transliteration calculations run on the device. Browser permissions and hosting authentication, when applicable, are separate from the app's local preferences.

## Reviewed text repairs (September 23, 2026)

`scripts/translations/content-repairs.json` records exact Hebrew and original/corrected fields. Existing English translations in Edot Mincha Amidah are moved to their matching Hebrew paragraphs without changing their edition attribution. Three new English/Russian/Ukrainian entries (a Tisha B’Av instruction, 21 Nisan, and bedtime confession instructions) use Kavvanah supplementary translations (2026). The `spoken` override corrects source typography classification for reviewed prayer/study text without changing the Hebrew, source `kind`, or stable paragraph identifiers. Run `python3 scripts/repair-texts.py --check` to verify these repairs.

## Russian Ashkenaz Siddur translation (2026-09-25)

The completed Russian Ashkenaz prayer corpus is maintained through one permanent manifest, `scripts/translations/russian.json`, and one importer, `scripts/import-russian-translations.py`. The manifest pins the exact Hebrew source and every destination section/paragraph index, groups repeated identical translations instead of storing duplicate batch files, and preserves the real edition/reference for externally sourced text. Run `python3 scripts/import-russian-translations.py --check` to verify that the checked-in corpus and its attribution metadata are reproducible.

The manifest consolidates the reviewed work that was temporarily split across Toldot web excerpts, Toldot Siddur Android EPUB alignment, repeated-passage review, biblical matching and completion batches. Those intermediate batch, audit and APK-catalog files are intentionally not retained in the release repository. The current manifest contains 2,722 exact target paragraph occurrences grouped into 2,000 translation records; after applying it, all 3,689 displayed Hebrew paragraphs in the current Ashkenaz corpus have Russian text.

Toldot Yeshurun passages retain the `toldot-siddur-2011` edition and their Toldot links. The web excerpts come from the 2011 Ashkenaz Siddur series, including https://toldot.com/articles/articles_16075.html and https://toldot.com/articles/articles_16194.html. The source states that republication is welcomed with an active Toldot.com hyperlink after each reproduced item; this is attribution-conditioned permission, not a public-domain or Creative Commons declaration. Additional Toldot passages were aligned against Hebrew/Russian EPUB material in the user-provided Toldot Siddur Android application; the APK itself is not included in the repository. No unrelated publisher text is relabeled as Toldot.

Complete biblical passages taken from the bundled Russian Synodal source retain `russian-synodal-1876` and their biblical references. Existing Kavvanah supplementary passages retain `kavvanah-supplement-2026`. New project-authored Russian prayer text now uses one stable edition identifier, `kavvanah-russian-2026`, instead of temporary batch-specific identifiers. Hebrew, English, Ukrainian and the Edot corpus are not changed by this consolidated importer. The Russian coverage is complete for the current Ashkenaz data set, but liturgical wording, piyyutim, selichot and halakhic instructions can still benefit from qualified community review before practical reliance.

The Paper and Dark paper texture is the replacement image supplied by the user on 2026-09-23. Its native proportions are preserved with automatic background height.
