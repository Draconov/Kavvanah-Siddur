#!/usr/bin/env python3
"""Apply Kavvanah's supplementary translations without replacing published editions.

Run after the Hebrew and public-domain translation importers. The checked-in
supplement stores its Hebrew source with every entry, so changed source text
cannot silently inherit a translation by paragraph position.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
EDITION_ID = 'kavvanah-supplement-2026'
EDITION_TITLE = 'Kavvanah supplementary translations (2026)'
LANGUAGES = ('en', 'ru', 'uk')
REUSE_ID = 'published-passage-reuse-2026'


def reuse_key(text):
    text = re.sub(r'[\u0591-\u05bd\u05bf-\u05c2\u05c4-\u05c7]', '', text)
    text = re.sub(r"(?<![א-ת])((?:ו?[בכלמש])|ו|)(ה['׳’]|יי|ײ)(?![א-ת])",
                  lambda match: match[1]+'יהוה', text)
    return ''.join(character for character in text if character.isalnum())


def fill_reused(paragraph, entry):
    if key(paragraph) != entry['id']:
        raise ValueError('Reused passage Hebrew mismatch')
    changed = []
    for language in LANGUAGES:
        addition = entry.get(language)
        if not addition or paragraph.get(language):
            continue
        evidence = addition['evidence']
        wanted = reuse_key(paragraph['he'])
        segments = evidence['segments']
        if (not evidence['fullTargetCoverage'] or evidence['targetCanonical'] != wanted
                or evidence['sourceCanonical'] != wanted
                or ''.join(reuse_key(s['he']) for s in segments) != wanted
                or ' '.join(s['text'] for s in segments) != addition['text']
                or ', '.join(s['refs'] for s in segments) != addition['refs']):
            raise ValueError('Reused passage does not cover the complete Hebrew source')
        paragraph[language] = addition['text']
        paragraph.setdefault('translationRefs', {})[language] = addition['refs']
        paragraph.setdefault('translationEditions', {})[language] = REUSE_ID
        changed.append(language)
    return changed


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
    for language in LANGUAGES:
        if language in entry and (not isinstance(entry[language], str) or not entry[language].strip()):
            raise ValueError(f'Empty or invalid {language} translation at {reference}')
    changed = []
    for language in LANGUAGES:
        if language not in entry:
            continue
        owned = paragraph.get('translationEditions', {}).get(language) == EDITION_ID
        if paragraph.get(language) and not owned:
            continue
        value = entry[language].strip()
        if value == paragraph.get(language) and owned:
            continue
        paragraph[language] = value
        paragraph.setdefault('translationRefs', {})[language] = reference
        paragraph.setdefault('translationEditions', {})[language] = EDITION_ID
        if language in paragraph.get('translationNotes', {}):
            del paragraph['translationNotes'][language]
            if not paragraph['translationNotes']:
                del paragraph['translationNotes']
        changed.append(language)
    return changed


def add_sources(data, paragraphs):
    present = {language for p in paragraphs for language in LANGUAGES
               if p.get('translationEditions', {}).get(language) == EDITION_ID}
    data['sources'] = [s for s in data['sources'] if s.get('id') != EDITION_ID]
    for language in sorted(present):
        data['sources'].append({
            'id': EDITION_ID, 'title': 'Kavvanah', 'version': EDITION_TITLE,
            'language': language, 'license': '',
            'url': '/',
        })


def apply(root=ROOT, check=False, require_complete=False):
    supplement = json.loads((root/'scripts/translations/kavvanah-supplement.json').read_text())
    if supplement['edition'] != EDITION_ID:
        raise ValueError('Unexpected supplementary edition')
    entries = {}
    for entry in supplement['prayers']:
        identity = key(entry)
        if entry['id'] != identity or identity in entries:
            raise ValueError(f'Duplicate or invalid Hebrew key: {entry["id"]}')
        entries[identity] = entry
    text_root = root/'public/texts'
    reused_path = root/'scripts/translations/reused-passages.json'
    reused = {entry['id']:entry for entry in json.loads(reused_path.read_text())} if reused_path.exists() else {}
    updated = {}
    changed = dict.fromkeys(LANGUAGES, 0)
    for nusach in ('ashkenaz', 'edot'):
        data = json.loads((text_root/f'{nusach}.json').read_text())
        for section in data['sections']:
            for paragraph in section['paragraphs']:
                identity = key(paragraph)
                if identity in reused:
                    for language in fill_reused(paragraph, reused[identity]):
                        changed[language] += 1
                if identity in entries:
                    for language in fill(paragraph, entries[identity], f'KAV {identity}'):
                        changed[language] += 1
        updated[nusach] = data
    for entry in supplement['verses']:
        book = entry['book']
        if book not in updated:
            updated[book] = json.loads((text_root/f'{book}.json').read_text())
        paragraph = updated[book]['text'][entry['chapter']-1][entry['verse']-1]
        for language in fill(paragraph, entry, f'KAV {book} {entry["chapter"]}:{entry["verse"]}'):
            changed[language] += 1
    remaining = {}
    for name, data in updated.items():
        paragraphs = ([p for s in data['sections'] for p in s['paragraphs']]
                      if 'sections' in data else [p for ch in data['text'] for p in ch])
        add_sources(data, paragraphs)
        remaining[name] = {language: sum(not p.get(language) for p in paragraphs) for language in LANGUAGES}
    if require_complete and any(n for counts in remaining.values() for n in counts.values()):
        raise ValueError(f'Translations remain incomplete: {remaining}')
    for name, data in updated.items():
        path = text_root/f'{name}.json'
        if check:
            if json.loads(path.read_text()) != data:
                raise ValueError(f'{name}: the supplementary translations have not been applied')
        else:
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    return {'updated': changed, 'remaining': remaining, 'uniqueSupplementaryPrayers': len(entries)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--require-complete', action='store_true')
    args = parser.parse_args()
    print(json.dumps(apply(check=args.check, require_complete=args.require_complete), indent=2))
