"""Import the pinned public-domain Ukrainian Freedom Bible USFM archive.

Usage: python3 scripts/import-ukrainian-translations.py ukrfb_usfm.zip
Source: https://ebible.org/Scriptures/ukrfb_usfm.zip
Only the Hebrew canon is imported. References are explicit, never guessed by
chapter lengths. See scripts/versification/README.md for edition differences.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('public_import', ROOT/'scripts/import-public-translations.py')
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)
SOURCE_SHA256 = '8b287e873f9a11e645ca756690258b6abd6a9d6e967dd4bd1ea850262aacff5f'
SOURCE_META = {
    'title': 'Tanakh · Ukrainian Freedom Bible',
    'version': 'Ukrainian Freedom Bible (Kulish–Puluj), eBible 2025',
    'language': 'uk', 'license': 'Public Domain',
    'url': 'https://ebible.org/find/details.php?id=ukrfb',
}
EXPECTED_GAPS = {'LEV 21:24', 'SNG 1:1', 'PSA 148:14'}


def parse_usfm(text):
    """Remove notes/headings, retain source verse numbers and exact wording."""
    text = re.sub(r'\\f\s.*?\\f\*', '', text, flags=re.S)
    parts = re.split(r'\\c\s+(\d+)\s*', text)
    chapters = []
    for n in range(1, len(parts), 2):
        verses = []
        for match in re.finditer(r'\\v\s+(\d+)\s+(.*?)(?=\\v\s|\Z)', parts[n+1], re.S):
            body = re.sub(r'^\\s\d?[^\n]*', '', match[2], flags=re.M)
            body = re.sub(r'\\[a-z][a-z0-9]*\*?\s*', '', body)
            body = ' '.join(body.split())
            if '\\' in body:
                raise ValueError('Unrecognized USFM markup')
            verses.append({'verse': int(match[1]), 'text': body})
        if len({v['verse'] for v in verses}) != len(verses):
            raise ValueError('Duplicate source verse number')
        chapters.append({'chapter': int(parts[n]), 'verses': verses})
    return chapters


def read_source(path):
    if hashlib.sha256(path.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unreviewed source revision: verify edition and reference mapping first.')
    books = {}
    with zipfile.ZipFile(path) as archive:
        for code, name in common.BOOKS.items():
            files = [f for f in archive.namelist() if f.endswith(f'-{code}ukrfb.usfm')]
            if len(files) != 1:
                raise ValueError(f'Missing or duplicate source book: {code}')
            books[code] = {'name': name, 'chapters': parse_usfm(archive.read(files[0]).decode('utf-8-sig'))}
    return books


def load_mappings():
    # Shared chapter boundaries follow RSO; Ukrainian Psalms follow English
    # numbering. Local exceptions below were checked against the actual wording.
    mapping = defaultdict(list, {k: list(v) for k, v in common.load_mappings().items() if k[0] != 'PSA'})
    def refs(value):
        code, ch, first, last = re.fullmatch(r'(\w{3}) (\d+):(\d+)(?:-(\d+))?', value).groups()
        return [(code, int(ch), v) for v in range(int(first), int(last or first)+1)]
    for line in (ROOT/'scripts/versification/eng.vrs').read_text().splitlines():
        if not line.startswith('PSA ') or '=' not in line:
            continue
        a, b = [refs(value.strip()) for value in line.split('=')]
        if len(a) != len(b):
            raise ValueError(f'Unresolved reference range: {line}')
        for (code,ch,v), target in zip(a,b):
            # This edition includes unnumbered superscriptions in source v1.
            mapping[code,ch,max(1,v)].append(target)

    def reset(code, *chapters):
        for key in list(mapping):
            if key[0] == code and key[1] in chapters:
                del mapping[key]
    def put(code, ch, v, *targets):
        mapping[code,ch,v] = [(code,c,n) for c,n in targets]
    def same(code, ch, v, *verses):
        put(code,ch,v,*[(ch,n) for n in verses])
    def shift(code, ch, start, end, delta):
        for v in range(start,end+1):
            same(code,ch,v,v+delta)

    # Combined and split sentences in this particular Ukrainian edition.
    same('GEN',3,1,1,2); shift('GEN',3,2,23,1)
    same('GEN',6,20,20,21); same('GEN',6,21,22)
    same('GEN',48,21,21,22)
    reset('LEV',5,6)
    same('LEV',5,24,24); same('LEV',5,25,24)
    same('LEV',5,26,25); same('LEV',5,27,26)
    same('LEV',6,22,22,23)
    same('LEV',14,55,55,56,57); same('LEV',17,15,15,16)
    same('NUM',8,25,25,26)
    reset('NUM',12,13,29,30)
    same('NUM',14,44,44,45); same('NUM',15,40,40,41)
    same('NUM',20,28,28,29)
    same('NUM',23,17,17); same('NUM',23,18,17); shift('NUM',23,19,31,-1)
    same('NUM',25,17,17,18); same('NUM',27,22,22,23)
    put('NUM',29,40,(30,1)); shift('NUM',30,1,16,1)
    same('DEU',16,21,21,22); same('DEU',24,21,21,22)
    reset('DEU',28,29)
    same('DEU',29,1,1); same('DEU',29,2,1); shift('DEU',29,3,29,-1)
    same('DEU',32,51,51,52); same('DEU',34,11,11,12)
    reset('JOS',5,6); reset('1KI',22)
    same('2SA',2,4,4); same('2SA',2,5,4); shift('2SA',2,6,33,-1)
    same('JOB',21,32,32,33); same('JOB',21,33,34)
    reset('PRO',4,13,18)
    same('PRO',30,30,30,31); same('PRO',30,31,32); same('PRO',30,32,33)
    reset('ISA',3,9)
    put('ISA',9,1,(8,23))
    shift('ISA',9,2,20,-1); same('ISA',9,21,20); same('ISA',9,22,20)
    reset('DAN',3)
    # SNG heading is absent; its first source verse is Hebrew verse 2.
    reset('SNG',1); shift('SNG',1,1,16,1)

    reset('PSA',60)  # This Psalm numbers its two heading verses separately.
    same('PSA',24,9,9,10)
    same('PSA',29,7,7,8); shift('PSA',29,8,10,1)
    same('PSA',54,4,6,7); same('PSA',54,5,8); same('PSA',54,6,9)
    same('PSA',89,51,52,53)
    same('PSA',106,47,47,48)
    same('PSA',127,5,5); same('PSA',127,6,5)
    return mapping


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    books = read_source(args.source)
    mapping = load_mappings(); updated = {}; missing = []
    for code, name in common.BOOKS.items():
        path = ROOT/'public/texts'/f'{common.book_id(name)}.json'
        target = json.loads(path.read_text())
        missing += common.map_book(code,books[code],target,mapping,'uk',SOURCE_META)
        updated[path] = target
    if set(missing) != EXPECTED_GAPS:
        raise ValueError(f'Unexpected missing translations: {missing}')
    updated.update(common.add_biblical_prayers(list(updated.values()),'uk',SOURCE_META))
    common.write_updates(updated, 'uk')
    print('Source SHA-256:', SOURCE_SHA256)
    print('Source omissions:', ', '.join(missing))
    print('Ukrainian Tanakh verses:',sum('uk' in p for d in updated.values() if 'text' in d for c in d['text'] for p in c))


if __name__ == '__main__':
    main()
