#!/usr/bin/env python3
"""Build Ukrainian Tanakh edition bundles used by Kavvanah.

The runtime keeps one file per Tanakh translation edition. This importer can:
- parse the reviewed Ohiienko 1962 HTML source supplied by the project owner;
- extract the already reviewed/aligned Kulish–Puluj corpus from the bundled
  canonical Tanakh data into its own edition bundle.

Usage:
  python3 scripts/import-ukrainian-tanakh-editions.py --bible-apk BIBLE.apk --ohienko SOURCE.htm --kulish
"""
from __future__ import annotations

import argparse
from collections import Counter, OrderedDict, defaultdict
from hashlib import sha256
import html as html_lib
import json
from pathlib import Path
import re
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/texts/translations/tanakh'
OH_SOURCE_SHA256 = '39d01a90dd8d85afe22a2e93f275fd3b6a0180b1ad3a93a61ebf9f4754aa5bd9'
APK_SHA256 = 'fa44628ccda9e6282e1c2f067d11d9bf32eef4611accfb677b154e80f1551a7b'


APK_FIRST_RUN = 'assets/flutter_assets/packages/bible/assets/first_run'
APK_VERSIFICATION = 'assets/flutter_assets/packages/versification/assets/version_to_scheme_id.json'
EXPECTED_YOUVERSION = {
    186: {'t':'Біблія в пер. Івана Огієнка 1962','a':'UBIO','l':'Ukrainian','scheme':4},
    1755: {'t':'Переклад Р. Турконяка','a':'УТТ','l':'Ukrainian','scheme':4},
}

def verify_bible_apk(path: Path):
    digest = sha256(path.read_bytes()).hexdigest()
    if digest != APK_SHA256:
        raise ValueError(f'Unreviewed Bible APK revision: {digest}')
    with ZipFile(path) as apk:
        language = json.loads(apk.read(f'{APK_FIRST_RUN}/uk.json'))
        ids = language.get('ids', [])
        schemes = json.loads(apk.read(APK_VERSIFICATION))
        for version_id, expected in EXPECTED_YOUVERSION.items():
            if version_id not in ids:
                raise ValueError(f'YouVersion Ukrainian catalog no longer lists {version_id}')
            meta = json.loads(apk.read(f'{APK_FIRST_RUN}/{version_id}.json'))
            for key in ('t','a','l'):
                if meta.get(key) != expected[key]:
                    raise ValueError(f'YouVersion {version_id} metadata changed: {meta}')
            if int(schemes[str(version_id)]) != expected['scheme']:
                raise ValueError(f'YouVersion {version_id} versification scheme changed')
    return digest

BOOKS = OrderedDict([
 ('GEN','genesis'),('EXO','exodus'),('LEV','leviticus'),('NUM','numbers'),('DEU','deuteronomy'),
 ('JOS','joshua'),('JDG','judges'),('RUT','ruth'),('1SA','i-samuel'),('2SA','ii-samuel'),
 ('1KI','i-kings'),('2KI','ii-kings'),('1CH','i-chronicles'),('2CH','ii-chronicles'),
 ('EZR','ezra'),('NEH','nehemiah'),('EST','esther'),('JOB','job'),('PSA','psalms'),
 ('PRO','proverbs'),('ECC','ecclesiastes'),('SNG','song-of-songs'),('ISA','isaiah'),
 ('JER','jeremiah'),('LAM','lamentations'),('EZK','ezekiel'),('DAN','daniel'),('HOS','hosea'),
 ('JOL','joel'),('AMO','amos'),('OBA','obadiah'),('JON','jonah'),('MIC','micah'),
 ('NAM','nahum'),('HAB','habakkuk'),('ZEP','zephaniah'),('HAG','haggai'),('ZEC','zechariah'),('MAL','malachi'),
])

OH_BOOK_HEADINGS = {
 '1. Перша книга Мойсеєва: Буття':'GEN','2. Друга книга Мойсеєва: Вихід':'EXO',
 '3. Третя книга Мойсеєва: Левит':'LEV','4. Четверта книга Мойсеєва: Числа':'NUM',
 '5. П’ята книга Мойсеєва: Повторення закону':'DEU','1. Книга Ісуса Навина (Книга Єгошої)':'JOS',
 '2. Книга Суддів':'JDG','3. Книга Рут':'RUT','4. Перша книга Самуїлова (або Перша книга царів)':'1SA',
 '5. Друга книга Самуїлова (або Друга книга царів)':'2SA','6. Перша книга царів':'1KI',
 '7. Друга книга царів':'2KI','8. Перша книга хроніки':'1CH','9. Друга книга хроніки':'2CH',
 '10. Книга Ездри':'EZR','11. Книга Неемії':'NEH','12. Книга Естер':'EST','1. Книга Йова':'JOB',
 '2. Книга Псалмів':'PSA','3. Книга приказок Соломонових':'PRO',
 '4. Книга Екклезіястова (або Проповідника)':'ECC','5. Пісня над піснями':'SNG',
 '1. Книга пророка Ісаї':'ISA','2. Книга пророка Єремії':'JER','3. Плач Єремії':'LAM',
 '4. Книга пророка Єзекіїля':'EZK','1. Книга пророка Даниїла':'DAN','2. Книга пророка Осії':'HOS',
 '3. Книга пророка Йоіла':'JOL','4. Книга пророка Амоса':'AMO','5. Книга пророка Овдія':'OBA',
 '6. Книга пророка Йони':'JON','7. Книга пророка Михея':'MIC','8. Книга пророка Наума':'NAM',
 '9. Книга пророка Авакума':'HAB','10. Книга пророка Софонії':'ZEP','11. Книга пророка Огія':'HAG',
 '12. Книга пророка Захарія':'ZEC','13. Книга пророка Малахії':'MAL',
}

def norm(value: str) -> str:
    return re.sub(r'\s+', ' ', value).strip()

def html_blocks(raw: str):
    """Yield h2/h3/h4/p blocks from permissive legacy HTML.

    The source contains several implicitly closed heading tags, so slicing from
    one block start tag to the next is more reliable than strict HTML parsing.
    """
    pattern = re.compile(r'<(h2|h3|h4|p)\b[^>]*>', re.I)
    starts = list(pattern.finditer(raw))
    blocks = []
    for index, match in enumerate(starts):
        body = raw[match.end() : starts[index + 1].start() if index + 1 < len(starts) else len(raw)]
        body = re.sub(
            r'<sup\b[^>]*>(.*?)</sup\s*>',
            lambda item: '\x00V' + re.sub(r'<[^>]+>', '', item.group(1)) + '\x00',
            body, flags=re.I | re.S,
        )
        body = html_lib.unescape(re.sub(r'<[^>]+>', ' ', body))
        blocks.append((match.group(1).lower(), body))
    return blocks


def parse_ohienko(path: Path):
    digest = sha256(path.read_bytes()).hexdigest()
    if digest != OH_SOURCE_SHA256:
        raise ValueError(f'Unreviewed Ohiienko source revision: {digest}')
    raw = path.read_bytes().decode('cp1251')
    headings = {norm(k):v for k,v in OH_BOOK_HEADINGS.items()}
    books: dict[str, OrderedDict[int, OrderedDict[int,str]]] = OrderedDict()
    book = None; chapter = None
    for tag, raw in html_blocks(raw):
        text = norm(raw.replace('\x00','')).rstrip(' >')
        if tag in ('h2','h3') and text in headings:
            book = headings[text]; books[book] = OrderedDict(); chapter = None; continue
        if book and tag in ('h3','h4'):
            match = re.search(r'(\d+)\s*$', text)
            if match and text not in headings:
                chapter = int(match.group(1)); books[book].setdefault(chapter, OrderedDict())
            continue
        if book and chapter and tag == 'p':
            matches = list(re.finditer(r'\x00V(\d+)\x00', raw))
            for index, match in enumerate(matches):
                verse = int(match.group(1)); start = match.end(); end = matches[index+1].start() if index+1 < len(matches) else len(raw)
                body = norm(raw[start:end])
                if body: books[book][chapter][verse] = body
    if list(books) != list(BOOKS):
        raise ValueError(f'Ohiienko book set/order mismatch: {list(books)}')
    return books


def target_shape(book_id: str):
    data = json.loads((ROOT/'public/texts'/f'{book_id}.json').read_text())
    return data, [[None for _ in chapter] for chapter in data['text']]


def record(text: str, refs: list[str], *, edition: str | None = None, combined: bool = False):
    item = {'text': text, 'ref': ', '.join(refs)}
    if edition: item['edition'] = edition
    if combined: item['note'] = 'combined'
    return item


def build_ohienko(source: Path):
    parsed = parse_ohienko(source)
    source_chapters = sum(len(book) for book in parsed.values())
    source_verses = sum(len(chapter) for book in parsed.values() for chapter in book.values())
    if (source_chapters, source_verses) != (930, 23214):
        raise ValueError(f'Ohiienko source shape changed: {source_chapters} chapters / {source_verses} verses')
    bundle = {
      'schema':1, 'language':'uk', 'edition':'uk-ohienko-1962',
      'sources':[{
        'title':'Tanakh · Ukrainian · Ohiienko',
        'version':'Біблія в пер. Івана Огієнка 1962 (UBIO · YouVersion 186)',
        'language':'uk',
        'license':'User-supplied source; redistribution terms are not stated in the source file',
        'url':'https://www.bible.com/uk/versions/186'
      }],
      'books':{}
    }
    total = 0
    for code, book_id in BOOKS.items():
        base, chapters = target_shape(book_id)
        assigned: dict[tuple[int,int], list[tuple[int,int,str]]] = defaultdict(list)
        if code == 'PSA':
            source_flat = []
            for sch in sorted(parsed[code]):
                for sv in sorted(parsed[code][sch]):
                    source_flat.append((sch, sv, parsed[code][sch][sv]))
            target_flat = [(ch,vs) for ch,c in enumerate(base['text'],1) for vs in range(1,len(c)+1)]
            if len(source_flat) != len(target_flat):
                raise ValueError(f'Psalm sequence changed: {len(source_flat)} != {len(target_flat)}')
            for source_item, target in zip(source_flat, target_flat): assigned[target].append(source_item)
        else:
            for sch, verses in parsed[code].items():
                for sv, text in verses.items():
                    destinations = [(sch,sv)]
                    if code == 'EXO' and sch == 20:
                        if 13 <= sv <= 16: destinations = [(20,13)]
                        elif sv >= 17: destinations = [(20,sv-3)]
                    elif code == 'NUM' and ((sch,sv) == (25,19) or (sch,sv) == (26,1)):
                        destinations = [(26,1)]
                    elif code == 'DEU' and sch == 5:
                        if 17 <= sv <= 20: destinations = [(5,17)]
                        elif sv >= 21: destinations = [(5,sv-3)]
                    elif code == '1CH' and sch == 12:
                        if sv == 4: destinations = [(12,4),(12,5)]
                        elif sv >= 5: destinations = [(12,sv+1)]
                    elif code == 'NEH' and sch == 7:
                        if sv == 68: destinations = [] # horse/mule addition absent from the Hebrew canon
                        elif sv >= 69: destinations = [(7,sv-1)]
                    elif code == 'ISA' and sch == 64:
                        if sv == 1: destinations = [(63,19)]
                        elif sv >= 2: destinations = [(64,sv-1)]
                    elif code == 'MAL' and sch == 4:
                        destinations = [(3,sv+18)]
                    for destination in destinations:
                        ch, vs = destination
                        if ch <= len(chapters) and vs <= len(chapters[ch-1]): assigned[ch,vs].append((sch,sv,text))
        fanout = Counter((sch, sv) for values in assigned.values() for sch, sv, _ in values)
        for ch, chapter in enumerate(chapters,1):
            for vs in range(1,len(chapter)+1):
                entries = assigned.get((ch,vs), [])
                if not entries: raise ValueError(f'Missing Ohiienko mapping: {code} {ch}:{vs}')
                refs = [f'{code} {sch}:{sv}' for sch,sv,_ in entries]
                # A source verse duplicated across two Hebrew verses is also marked combined.
                source_fanout = any(fanout[(sch, sv)] > 1 for sch, sv, _ in entries)
                text = ' '.join(e[2] for e in entries)
                chapter[vs-1] = record(text, refs, combined=len(entries)>1 or source_fanout)
                total += 1
        bundle['books'][book_id] = {'chapters':chapters}
    if total != 23206: raise ValueError(f'Ohiienko verse total changed: {total}')
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT/'uk-ohienko-1962.json'
    path.write_text(json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+'\n')
    return path, total


def build_kulish():
    sources = OrderedDict()
    bundle = {'schema':1,'language':'uk','edition':'uk-kulish-puluj-1905','sources':[],'books':{}}
    total = 0
    for code, book_id in BOOKS.items():
        data = json.loads((ROOT/'public/texts'/f'{book_id}.json').read_text())
        chapters=[]
        for source in data['sources']:
            if source.get('language') == 'uk':
                key=(source.get('id'),source.get('title'),source.get('version'),source.get('url'))
                sources[key]=source
        for chapter in data['text']:
            out=[]
            for paragraph in chapter:
                text=paragraph.get('uk','').strip()
                if not text: raise ValueError(f'Missing aligned Kulish text in {book_id}')
                refs=[paragraph.get('translationRefs',{}).get('uk','')]
                refs=[r for r in refs if r]
                edition=paragraph.get('translationEditions',{}).get('uk')
                note=paragraph.get('translationNotes',{}).get('uk') == 'combined'
                if refs or edition or note:
                    out.append(record(text,refs or [f'{code} aligned'],edition=edition,combined=note))
                else: out.append(text)
                total += 1
            chapters.append(out)
        bundle['books'][book_id]={'chapters':chapters}
    if total != 23206: raise ValueError(f'Kulish verse total changed: {total}')
    bundle['sources']=list(sources.values())
    OUT.mkdir(parents=True, exist_ok=True)
    path=OUT/'uk-kulish-puluj-1905.json'
    path.write_text(json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+'\n')
    return path,total


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ohienko', type=Path)
    parser.add_argument('--kulish', action='store_true')
    parser.add_argument('--bible-apk', type=Path, help='optional reviewed YouVersion APK used to verify edition metadata')
    args=parser.parse_args()
    if not args.ohienko and not args.kulish and not args.bible_apk: parser.error('select --ohienko SOURCE, --kulish and/or --bible-apk APK')
    if args.bible_apk:
        digest=verify_bible_apk(args.bible_apk); print('Verified YouVersion metadata APK SHA-256:', digest)
    if args.ohienko:
        path,total=build_ohienko(args.ohienko); print(f'Ohiienko: {total} verses -> {path.relative_to(ROOT)}')
    if args.kulish:
        path,total=build_kulish(); print(f'Kulish–Puluj: {total} verses -> {path.relative_to(ROOT)}')
    if not args.bible_apk: print('Pinned YouVersion metadata source APK SHA-256:', APK_SHA256)

if __name__ == '__main__': main()
