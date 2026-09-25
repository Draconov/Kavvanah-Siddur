#!/usr/bin/env python3
"""Apply the small reviewed Kavvanah supplements to Tanakh translation files."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
EDITION_ID = 'kavvanah-supplement-2026'
EDITION_TITLE = 'Kavvanah supplementary translations (2026)'
LANGUAGES = ('ru', 'uk')


def normalized_hebrew(text):
    text = re.sub(r'[\u0591-\u05bd\u05bf-\u05c2\u05c4-\u05c7]', '', text)
    text = re.sub(r'(?<![א-ת])(?:יי|ײ)(?![א-ת])', 'יהוה', text)
    return ''.join(re.findall('[א-ת0-9]', text))


def key(paragraph):
    identity = paragraph.get('kind', 'prayer') + ':' + normalized_hebrew(paragraph['he'])
    return hashlib.sha256(identity.encode()).hexdigest()[:16]


def fill(paragraph, entry, reference):
    if key(paragraph) != key(entry):
        raise ValueError(f'Hebrew source mismatch at {reference}')
    changed = []
    for language in LANGUAGES:
        if language not in entry:
            continue
        value = entry[language]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f'Empty or invalid {language} translation at {reference}')
        owned = paragraph.get('translationEditions', {}).get(language) == EDITION_ID
        if paragraph.get(language) and not owned:
            continue
        if paragraph.get(language) == value and owned:
            continue
        paragraph[language] = value.strip()
        paragraph.setdefault('translationRefs', {})[language] = reference
        paragraph.setdefault('translationEditions', {})[language] = EDITION_ID
        if language in paragraph.get('translationNotes', {}):
            del paragraph['translationNotes'][language]
            if not paragraph['translationNotes']:
                del paragraph['translationNotes']
        changed.append(language)
    return changed


def add_sources(data):
    paragraphs = [p for chapter in data['text'] for p in chapter]
    present = {language for p in paragraphs for language in LANGUAGES
               if p.get('translationEditions', {}).get(language) == EDITION_ID}
    data['sources'] = [source for source in data['sources'] if source.get('id') != EDITION_ID]
    for language in sorted(present):
        data['sources'].append({
            'id': EDITION_ID,
            'title': 'Kavvanah',
            'version': EDITION_TITLE,
            'language': language,
            'license': '',
            'url': '/',
        })


def apply(root=ROOT, check=False):
    manifest = json.loads((root / 'scripts/translations/tanakh-supplement.json').read_text(encoding='utf-8'))
    if manifest.get('edition') != EDITION_ID:
        raise ValueError('Unexpected supplementary edition')
    updated = {}
    changed = dict.fromkeys(LANGUAGES, 0)
    for entry in manifest['verses']:
        book = entry['book']
        if book not in updated:
            updated[book] = json.loads((root / 'public/texts' / f'{book}.json').read_text(encoding='utf-8'))
        paragraph = updated[book]['text'][entry['chapter'] - 1][entry['verse'] - 1]
        reference = f'KAV {book} {entry["chapter"]}:{entry["verse"]}'
        for language in fill(paragraph, entry, reference):
            changed[language] += 1
    for book, data in updated.items():
        add_sources(data)
        path = root / 'public/texts' / f'{book}.json'
        if check:
            if json.loads(path.read_text(encoding='utf-8')) != data:
                raise ValueError(f'{book}: Tanakh supplement needs reapplying')
        else:
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    return {'updated': changed, 'verses': len(manifest['verses'])}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    print(json.dumps(apply(check=args.check), ensure_ascii=False, indent=2))
