# Content and software notices

Kavvanah preserves edition metadata in every book and siddur JSON file. The reader's “Text editions & attribution” panel links to the source editions. Texts were imported from the [Sefaria public export](https://github.com/Sefaria/Sefaria-Export) using `scripts/import-texts.py` in September 2026.

## Text editions

| Material | Edition | Source-declared license |
| --- | --- | --- |
| Tanakh Hebrew | Tanach with Nikkud | Public Domain |
| Tanakh English | The Holy Scriptures: A New Translation (JPS 1917) | Public Domain |
| Russian Tanakh and exact biblical passages in the siddur | Russian Synodal Translation (1876), CrossWire RusSynodal 1.9.1 | Public Domain |
| Ukrainian Tanakh · Kulish–Puluj | Ukrainian Freedom Bible, historical Kulish–Puluj translation, eBible revision 2025-02-05 | Public Domain |
| Ukrainian Tanakh · Ohiienko | Іван Огієнко, 1962 (UBIO / YouVersion edition 186); imported from the user-supplied Old Testament HTML | Source file does not state redistribution terms |
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

Siddur translations are no longer duplicated in maintenance manifests: the checked-in language files under `public/texts/translations/` are the canonical prayer translations. Small Tanakh omissions remain reproducible through `scripts/translations/tanakh-supplement.json` and `scripts/import-tanakh-supplement.py`, which match the exact Hebrew source before applying a `KAV` reference and the `kavvanah-supplement-2026` edition.

There are five supplementary language entries across four Tanakh verses: Russian Psalm 142:1 and Song of Songs 1:1; Ukrainian Leviticus 21:24, Psalm 148:14, and Song of Songs 1:1. The public-source importers leave these omissions empty so the Tanakh supplement can fill them explicitly. Run `python3 scripts/import-tanakh-supplement.py --check` to verify the checked-in result.

## Preferred Tanakh editions

Kavvanah stores a preferred translation edition independently for English, Russian, and Ukrainian. The edition registry lives in `lib/siddur/translation-editions.json`; adding another Tanakh edition later requires one registry entry and, for a bundled external edition, one edition file at the configured path. Existing users keep a separate preference for each language.

Current edition choices are:

- English: **JPS 1917**.
- Russian: **Russian Synodal 1876**.
- Ukrainian default: **Jewish modern · Varda Torah + Turkonjak** — Torah source: the Varda/Publishers Row Ukrainian Torah supplied for this project; Nevi’im and Ketuvim source: the project-owner supplied Turkonjak/UBT corpus where its LXX numbering is already reviewed against Kavvanah.
- Ukrainian alternatives: **Огієнко 1962**, **Турконяк · УБТ 1997–2007 (LXX)**, and **Куліш–Пулюй 1905**.

Two Ukrainian Tanakh editions are now fully bundled as independent files under `public/texts/translations/tanakh/`: **Огієнко 1962** and **Куліш–Пулюй 1905**. Each file contains all 23,206 displayed Tanakh verses and exactly matches Kavvanah's 39-book Hebrew structure. Selecting either edition in Settings loads that edition directly; it is no longer a placeholder.

The Ohiienko corpus is built reproducibly by `scripts/import-ukrainian-tanakh-editions.py` from the user-supplied `Biblia_Staryi_zapovit.htm`. The source identifies itself as Metropolitan Ilarion (Ivan Ohiienko)'s 1962 translation from Hebrew. Its reviewed source SHA-256 is `39d01a90dd8d85afe22a2e93f275fd3b6a0180b1ad3a93a61ebf9f4754aa5bd9`. Kavvanah uses explicit mappings for known versification differences rather than chapter-length inference: the grouped commandments in Exodus 20 and Deuteronomy 5, the Numbers 25/26 boundary, 1 Chronicles 12, Nehemiah 7, Orthodox-style Psalm numbering, Isaiah 63/64, and Malachi 3/4. Paragraph metadata keeps the original Ohiienko source reference whenever the displayed Hebrew reference differs.

The earlier YouVersion Bible APK remains a metadata source for version **186 / UBIO** and **1755 / УТТ**. A later project-owner supplied Turkonjak XAPK (SHA-256 `a7785ae36da1498ca76de2c37188cff6e4ef2b570e3c50f750ed561db4689217`) contains an embedded `uk-utt--1.yes` YES3 Bible asset, while the supplied `4205_TUB.zip` (SHA-256 `8d06571f18f118093bf1c73bb85f1ccd4723d99bc2261b162fc8984d7e4a9920`) contains the corresponding `TUB.SQLite3` corpus. Its own metadata identifies it as the Ukrainian Bible Society translation led by Rafail Turkonjak, 1997–2007, with the Old Testament based on the LXX. `scripts/import-turkonjak-tanakh.py` verifies both supplied artifacts and builds the reviewed subset without scraping Bible.com. For Psalms and Song of Songs it uses the checked-in SIL Russian-Orthodox-to-Original/BHS versification table plus reviewed TUB-specific corrections; Judges uses an explicit TUB chapter-label normalization because the SQLite source skips chapter labels 4 and 12 while retaining the complete sequential text.


The current Turkonjak bundle contains **21 books / 7,353 displayed verses**. Eighteen books still use direct structure-identity import; the reviewed mapping pass additionally brings in **Judges (618/618 verses), Psalms (2,527/2,527 canonical Hebrew-display verses), and Song of Songs (117 displayed verses)**. Psalm 151 is intentionally excluded from the 150-psalm Tanakh display. Twenty-three displayed slots use an explicitly tagged Ohiienko 1962 fallback because the TUB source slot is empty or has no direct displayed Hebrew equivalent; Song of Songs 1:1 is one such heading fallback. Books whose LXX numbering remains unresolved are not guessed into place: the edition registry records the exact available-book set and falls back to Ohiienko 1962 for those books until reviewed alignment rules are added. This makes the default Jewish-modern composite use Turkonjak for all Psalms and for additional aligned Nevi’im/Ketuvim books while keeping provenance explicit.

The supplied Varda PDF is the **Ukrainian first edition (2024)** of *Тора: П’ятикнижжя Мойсеєве*. Its SHA-256 is `a26ecc2a8beaff333b8cdf5488234c2083c4684d8560a104a8bde3d5e6ee67a8`. It is image-only in the supplied copy, so Kavvanah does not pretend that its Torah component has already been machine-imported; the component remains on Ohiienko fallback until a reviewed text extraction is completed.

`uk-kulish-puluj-1905.json` extracts the already reviewed/aligned public-domain Kulish–Puluj corpus from Kavvanah's canonical Tanakh data into its own selectable edition file. It preserves original verse references and the three separately identified Kavvanah omission supplements.

The **Jewish modern · Varda Torah + Turkonjak UTT** preference is implemented as a per-book composite preset rather than a fake standalone translation. Torah books resolve to the hidden `uk-varda-torah` component; Nevi’im and Ketuvim resolve to `uk-turkonjak-utt`. Each component falls back independently to Ohiienko 1962 only while that component is not bundled. This means a future Varda Torah import can become active immediately for Genesis–Deuteronomy even if Turkonjak is still missing, and vice versa. The reader always displays the edition actually used for the open book and never relabels fallback wording as Varda or Turkonjak. Kulish–Puluj remains available as an explicitly selected historical edition rather than serving as the modern default fallback.

Source references: Varda Ukrainian Torah: https://fliphtml5.com/esre/jcde/%D0%A2%D0%BE%D1%80%D0%B0%3A_%D0%9F%E2%80%99%D1%8F%D1%82%D0%B8%D0%BA%D0%BD%D0%B8%D0%B6%D0%B6%D1%8F%C2%A0%D0%9C%D0%BE%D0%B9%D1%81%D0%B5%D1%94%D0%B2%D0%B5/19/ ; Turkonjak UTT: https://www.bible.com/uk/versions/1755 ; Ohiienko 1962: https://www.bible.com/uk/versions/186 .

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

`scripts/translations/content-repairs.json` now contains only reviewed non-translation corpus repairs. Its `spoken` overrides correct source typography classification for prayer/study text without changing Hebrew, source `kind`, stable paragraph identifiers, or storing duplicate translation prose. The known Edot Mincha English segmentation offset is corrected structurally by `scripts/import-texts.py` during source import. Project-authored Siddur additions such as the Tisha B’Av instruction, 21 Nisan, and bedtime-confession instruction live only in the canonical `public/texts/translations/en.json`, `ru.json`, and `uk.json` files with their Kavvanah supplementary edition metadata. Run `python3 scripts/repair-texts.py --check` to verify the remaining corpus repairs.

## Siddur translation files and Russian Ashkenaz completion (2026-09-25)

The Hebrew prayer structure is stored only in `public/texts/ashkenaz.json` and `public/texts/edot.json`. Prayer translations are stored once per language in `public/texts/translations/en.json`, `public/texts/translations/ru.json`, and `public/texts/translations/uk.json`. Each language file contains both nusachim, its own source metadata, and paragraph-level reference/edition metadata where needed. The app loads the selected language file and joins it to the Hebrew structure by stable section id and paragraph position. Run `python3 scripts/validate-siddur-translations.py` to verify the split and the complete Russian Ashkenaz coverage.

The Russian file consolidates the reviewed work that was temporarily split across Toldot web excerpts, Toldot Siddur Android EPUB alignment, repeated-passage review, biblical matching and completion batches. Those intermediate batch, audit, duplicate manifest and APK-catalog files are intentionally not retained. All 3,689 displayed Hebrew paragraphs in the current Ashkenaz corpus have Russian text. Edot Russian coverage is also expanded in the same canonical file: exact normalized Hebrew shared with Ashkenaz reuses a translation only when every translated Ashkenaz occurrence has the same Russian wording; this conservative reuse currently fills 109 additional Edot paragraphs.

English and Ukrainian Ashkenaz completion is being expanded directly in the canonical per-language files rather than through temporary batch manifests. Exact repeated Hebrew is reused only when the existing translation is unambiguous. Exact whole-verse and contiguous-verse passages may reuse the bundled public-domain JPS 1917 English Tanakh or Ukrainian Freedom Bible and retain their source metadata; newly translated liturgical prose is marked as Kavvanah supplementary text. The Weekday Ashkenaz English corpus is complete in the current data set; Shabbat, festival, blessing, and Ukrainian coverage remain in progress.

Toldot Yeshurun passages retain the `toldot-siddur-2011` edition and their Toldot links. The web excerpts come from the 2011 Ashkenaz Siddur series, including https://toldot.com/articles/articles_16075.html and https://toldot.com/articles/articles_16194.html. The source states that republication is welcomed with an active Toldot.com hyperlink after each reproduced item; this is attribution-conditioned permission, not a public-domain or Creative Commons declaration. Additional Toldot passages were aligned against Hebrew/Russian EPUB material in the user-provided Toldot Siddur Android application; the APK itself is not included in the repository. No unrelated publisher text is relabeled as Toldot.

Complete biblical passages taken from the bundled Russian Synodal source retain `russian-synodal-1876` and their biblical references. Kavvanah-authored prayer text uses stable Kavvanah edition identifiers rather than temporary batch identifiers. The Russian Ashkenaz coverage is complete for the current data set, but liturgical wording, piyyutim, selichot and halakhic instructions can still benefit from qualified community review before practical reliance.


### Hitas Russian Siddur excerpts

The project-owner supplied **Hitas 3.8.0** Android APK (SHA-256 `4da6c2ea0b3039791d3ae064095252748617b93a59a19afc2ee8d0c6d5904245`) contains two bundled Russian Siddur HTML excerpts: **Avinu Malkeinu** and **Mincha / Aleinu**. Kavvanah does not treat that APK as a complete Siddur. In the current corpus only the complete bundled Aleinu wording is used, and only for the seven Edot Aleinu sections whose corresponding Russian fields were empty. The three Aleinu records (title plus the two prayer paragraphs) are reused across those occurrences, adding 21 paragraph translations. They carry the `hitas-siddur-3.8.0` edition identifier and APK digest reference in `public/texts/translations/ru.json`; the APK itself is not committed.

Together with the 109 conservative Ashkenaz-to-Edot exact-Hebrew reuses above, this source pass raises Russian Edot coverage from **517 to 647 of 2,924 paragraphs** without adding another translation manifest or batch file.

The Paper and Dark paper texture is the replacement image supplied by the user on 2026-09-23. Its native proportions are preserved with automatic background height.
