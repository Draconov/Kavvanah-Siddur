# Russian Synodal reference mapping

`rso.vrs` is copied unchanged from [SIL libpalaso](https://github.com/sillsdev/libpalaso/blob/5ecf001feffbeeb4381b1d641aa9a514a8007785/SIL.Scripture/Resources/rso.vrs.txt), under the adjacent MIT license. Its left side uses Russian Orthodox references; its right side uses Original/BHS references. The importer retains multiple mappings of a source verse rather than discarding them.

Reviewed adjustments for CrossWire RusSynodal 1.9.1 and the bundled Sefaria/JPS Hebrew:

| Source reference | Bundled Hebrew reference | Reason |
| --- | --- | --- |
| Isaiah 3:20–25 | Isaiah 3:21–26 | Corrects the table's 16–21 typo; the source's rings follow the combined jewelry verses |
| Psalm 89:1–2 | Psalm 90:1 | Source separates the heading from the opening sentence |
| Psalm 89:3–5 | Psalm 90:2–4 | Offset after the separated heading |
| Psalm 89:6 | Psalm 90:5–6 | Source combines the grass sentences; repeated with a combined-passage label |
| Psalm 114:9 | None | Empty JSON placeholder; source 114:8 contains Hebrew 116:8–9, as the table specifies |
| Proverbs 13:14; 18:8 | None | Greek additions absent from the Hebrew canon |
| Daniel 5:31 | Daniel 6:1 | Darius's accession begins the Hebrew chapter |
| Daniel 6:1–28 | Daniel 6:2–29 | Follows that chapter boundary |
| Original Exodus 20:13–16 | Exodus 20:13 | Four commandments grouped in the bundled Hebrew; subsequent verses shift by three |
| Original Deuteronomy 5:17–20 | Deuteronomy 5:17 | Same grouping; subsequent verses shift by three |
| Original Numbers 25:19 | Numbers 26:1 | The bundled Hebrew places “after the plague” in 26:1 |

The source JSON lacks the headings for Hebrew Psalm 142:1 and Song of Songs 1:1. These remain untranslated. The importer pins the source SHA-256, validates that these are the only missing references, and excludes additional source chapters/books. Complete biblical siddur passages are matched by exact Hebrew letters across full consecutive verses; combined source passages and instructions are excluded from that reuse.

## Ukrainian Freedom Bible

`eng.vrs` is copied unchanged from the same [SIL libpalaso revision](https://github.com/sillsdev/libpalaso/blob/5ecf001feffbeeb4381b1d641aa9a514a8007785/SIL.Scripture/Resources/eng.vrs.txt), under the adjacent MIT license. Ukrainian Psalms use its English-to-Original numbering, with source verse zero (a heading) folded into source verse one where this edition prints them together. Psalm 60 has separately numbered heading verses and follows Original numbering directly. Other books use the RSO boundaries with the explicit overrides below. These choices are based on source references and wording, not chapter-length matching.

| Ukrainian source | Original Hebrew reference | Edition difference |
| --- | --- | --- |
| Genesis 3:1; 3:2–23 | 3:1–2; 3:3–24 | Woman's first reply included in source verse 1 |
| Genesis 6:20–21; 48:21 | 6:20–22; 48:21–22 | Combined concluding sentences |
| Leviticus 5:1–23; 5:24–25; 5:26–27 | 5:1–23; 5:24; 5:25–26 | Hebrew chapter boundary, restitution sentence split |
| Leviticus 6:1–21; 6:22 | 6:1–21; 6:22–23 | Hebrew boundary, final rules combined |
| Leviticus 14:55; 17:15 | 14:55–57; 17:15–16 | Concluding rules combined |
| Numbers 12–13; Joshua 5–6; I Kings 22; Proverbs 4, 13, 18; Isaiah 3; Daniel 3 | Same chapter/verse references | Overrides differing RSO segmentation or additions |
| Numbers 8:25; 14:44; 15:40; 20:28; 25:17; 27:22 | Each stated verse and its following verse | Combined concluding sentences |
| Numbers 23:17–18; 23:19–31 | 23:17; 23:18–30 | Balak's question split into a separate verse |
| Numbers 29:40; 30:1–16 | 30:1; 30:2–17 | Chapter boundary follows English numbering |
| Deuteronomy 16:21; 24:21; 32:51; 34:11 | Each stated verse and its following verse | Combined concluding sentences |
| Deuteronomy 28:69; 29:1–2; 29:3–29 | 28:69; 29:1; 29:2–28 | Covenant separately numbered; Moses' introduction split |
| II Samuel 2:4–5; 2:6–33 | 2:4; 2:5–32 | Report about Jabesh split from anointing |
| Job 21:32; 21:33 | 21:32–33; 21:34 | Grave/procession sentences combined |
| Proverbs 30:30; 30:31–32 | 30:30–31; 30:32–33 | Lion and other stately creatures combined |
| Isaiah 9:1; 9:2–20; 9:21–22 | 8:23; 9:1–19; 9:20 | Opening chapter boundary and separate final refrain |
| Song of Songs 1:1–16 | 1:2–17 | Source lacks the numbered title |
| Psalm 24:9; 29:7; 29:8–10 | 24:9–10; 29:7–8; 29:9–11 | Combined questions and descriptions |
| Psalm 54:4; 54:5–6 | 54:6–7; 54:8–9 | Helper/enemies sentences combined, after heading offsets |
| Psalm 89:51; 106:47 | 89:52–53; 106:47–48 | Closing doxologies included in prior source verse |
| Psalm 127:5–6 | 127:5 | Final sentence split |

Source omissions: Leviticus 21:24, Psalm 148:14, Song of Songs 1:1. The importer pins the archive checksum and rejects any other missing reference. Joined and repeated source passages retain all source wording and original reference metadata. The same grouped commandments and Numbers 26:1 app-reference adjustments described above apply to both languages.
