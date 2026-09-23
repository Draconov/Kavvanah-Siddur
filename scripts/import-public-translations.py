"""Import public-domain RusSynodal by explicit verse references.

Usage: python3 scripts/import-public-translations.py SOURCE.json
Source: scrollmapper/bible_databases, formats/json/RusSynodal.json (CrossWire
RusSynodal 1.9.1). No network requests and no chapter-length/fuzzy alignment.
SIL's Russian Orthodox -> Original table supplies reference mappings. Local
edition exceptions below are documented in CONTENT_SOURCES.md.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA256 = '5fbf2ff04f3e87d0cc9ee465fd276f3a8727b4688cdbd8988b99312566b4978e'
BOOKS = dict(zip(
    'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL'.split(),
    ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','I Samuel','II Samuel','I Kings','II Kings','I Chronicles','II Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'],
))
SOURCE_META = {
    'title':'Tanakh · Russian Synodal',
    'version':'Russian Synodal Translation (1876), RusSynodal 1.9.1',
    'language':'ru', 'license':'Public Domain',
    'url':'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=RusSynodal',
}

def book_id(name):
    return name.lower().replace(' ', '-').replace('song-of-solomon', 'song-of-songs')

def refs(value):
    code, chapter, first, last = re.fullmatch(r'(\w{3}) (\d+):(\d+)(?:-(\d+))?', value).groups()
    return [(code, int(chapter), v) for v in range(int(first), int(last or first)+1) if v > 0]

def load_mappings():
    result = defaultdict(list)
    for line in (ROOT/'scripts/versification/rso.vrs').read_text().splitlines():
        if '=' not in line or line.startswith('#') or line[:3] not in BOOKS:
            continue
        left, right = line.split('=')
        source, target = refs(left.strip()), refs(right.strip())
        if not source or not target:
            continue
        if left.strip() == 'PSA 89:2-6':
            # The source separates the heading and combines Hebrew 90:5-6.
            for v in range(2,7):
                result['PSA',89,v].append(('PSA',90,v-1))
            result['PSA',89,6].append(('PSA',90,6))
            continue
        if len(source) != len(target):
            raise ValueError(f'Unresolved verse range: {line}')
        for a, b in zip(source, target):
            result[a].append(b)
    # SIL rso 1.3 has a typo here: rings follow the jewelry in Hebrew 3:21.
    for v in range(20, 26):
        result['ISA',3,v] = [('ISA',3,v+1)]
    # Greek additions must not be paired with the next Hebrew verse.
    result['PRO',13,14] = []
    result['PRO',18,8] = []
    # Empty export placeholder after the combined source verse 114:8.
    result['PSA',114,9] = []
    # Synodal starts Daniel 6 after Darius receives the kingdom; Hebrew before.
    result['DAN',5,31] = [('DAN',6,1)]
    for v in range(1,29):
        result['DAN',6,v] = [('DAN',6,v+1)]
    return result

def app_ref(ref):
    code, chapter, verse = ref
    # JPS/Sefaria groups four commandments into one Hebrew verse.
    if code == 'EXO' and chapter == 20 and verse >= 13:
        verse = 13 if verse <= 16 else verse-3
    if code == 'DEU' and chapter == 5 and verse >= 17:
        verse = 17 if verse <= 20 else verse-3
    # This edition includes "after the plague" in Numbers 26:1.
    if ref == ('NUM',25,19):
        return ('NUM',26,1)
    return code, chapter, verse

def map_book(code, source, target, mapping, language='ru', metadata=SOURCE_META):
    assigned = defaultdict(dict)
    source_targets = defaultdict(set)
    for chapter in source['chapters']:
        for verse in chapter['verses']:
            origin = code, chapter['chapter'], verse['verse']
            text = verse['text'].strip()
            if not text:
                continue
            for destination in mapping.get(origin, [origin]):
                dc, ch, vs = app_ref(destination)
                if dc != code or ch > len(target['text']) or vs > len(target['text'][ch-1]):
                    continue  # additions outside the Hebrew canon
                assigned[ch,vs][origin] = text
                source_targets[origin].add((ch,vs))
    missing=[]
    for ch, verses in enumerate(target['text'],1):
        for vs, paragraph in enumerate(verses,1):
            paragraph.pop(language, None)
            for key in ('translationRefs', 'translationNotes', 'translationEditions'):
                if key in paragraph:
                    paragraph[key].pop(language, None)
                    if not paragraph[key]:
                        paragraph.pop(key)
            entries=assigned.get((ch,vs), {})
            if not entries:
                missing.append(f'{code} {ch}:{vs}')
                continue
            paragraph[language]=' '.join(entries.values())
            paragraph.setdefault('translationRefs', {})[language]=', '.join(f'{c} {n}:{v}' for c,n,v in entries)
            if any(len(source_targets[origin]) > 1 for origin in entries):
                paragraph.setdefault('translationNotes', {})[language]='combined'
    target['sources']=[s for s in target['sources'] if s['language']!=language]+[metadata]
    return missing

def normalized_hebrew(text):
    return re.sub('[^א-ת]', '', text)

def add_biblical_prayers(books, language='ru', metadata=SOURCE_META):
    """Match complete Hebrew verses/passages only; never partial/fuzzy text."""
    index=defaultdict(list)
    for book in books:
        flat=[p for ch in book['text'] for p in ch]
        for i,p in enumerate(flat):
            text=normalized_hebrew(p['he'])
            if len(text)>=12:
                index[text[:12]].append((flat,i))
    updated={}
    for nusach in ('ashkenaz','edot'):
        path=ROOT/'public/texts'/f'{nusach}.json'
        data=json.loads(path.read_text()); count=0
        for section in data['sections']:
            for p in section['paragraphs']:
                if p.get('translationRefs',{}).get(language):
                    p.pop(language,None)
                    p['translationRefs'].pop(language)
                    if not p['translationRefs']:
                        p.pop('translationRefs')
                    for field in ('translationNotes', 'translationEditions'):
                        if field in p:
                            p[field].pop(language, None)
                            if not p[field]:
                                p.pop(field)
                if p.get('kind')=='instruction':
                    continue
                wanted=normalized_hebrew(p['he']); matches={}
                for verses,i in index[wanted[:12]]:
                    he=''; translated=[]; reference=[]
                    for verse in verses[i:]:
                        if not verse.get(language) or verse.get('translationNotes',{}).get(language):
                            break
                        he+=normalized_hebrew(verse['he'])
                        if not wanted.startswith(he):
                            break
                        translated.append(verse[language]);reference.append(verse['translationRefs'][language])
                        if he==wanted:
                            matches[' '.join(translated)]=', '.join(reference)
                            break
                if len(matches)==1:
                    p[language],reference=next(iter(matches.items()))
                    p.setdefault('translationRefs',{})[language]=reference
                    count+=1
        data['sources']=[s for s in data['sources'] if s['language']!=language]
        if count:
            data['sources'].append(metadata)
        updated[path]=data
        print(f'{nusach}: {count} complete biblical passages')
    return updated

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args=parser.parse_args()
    if hashlib.sha256(args.source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unreviewed source revision: verify its edition and verse mapping before importing.')
    source=json.loads(args.source.read_text()); mapping=load_mappings()
    updated={}; missing=[]
    for code,name in BOOKS.items():
        path=ROOT/'public/texts'/f'{book_id(name)}.json'
        target=json.loads(path.read_text())
        original=next(b for b in source['books'] if b['name']==name)
        missing+=map_book(code,original,target,mapping)
        updated[path]=target
    # Source omits two numbered headings. Any new gap fails the import.
    if set(missing)!={'PSA 142:1','SNG 1:1'}:
        raise ValueError(f'Unexpected missing translations: {missing}')
    updated.update(add_biblical_prayers(list(updated.values())))
    for path,data in updated.items():
        path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print('Source SHA-256:',hashlib.sha256(args.source.read_bytes()).hexdigest())
    print('Source omits numbered headings:',', '.join(missing))
    print('Russian Tanakh verses:',sum('ru' in p for d in updated.values() if 'text' in d for c in d['text'] for p in c))

if __name__=='__main__':
    main()
