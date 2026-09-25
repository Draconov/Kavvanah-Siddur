#!/usr/bin/env python3
"""Apply the unified reviewed Russian Ashkenaz translation manifest.

Every target is pinned by section, paragraph index, and exact Hebrew source text. Existing text is never overwritten silently.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = Path('scripts/translations/russian.json')
TEXT_PATH = Path('public/texts/ashkenaz.json')
OBSOLETE_EDITIONS = {
    'kavvanah-russian-instructions-2026',
    'kavvanah-russian-prayers-2026',
    'kavvanah-russian-original-batch-3-2026',
    'kavvanah-russian-original-batch-4-2026',
    'kavvanah-russian-completion-batch-5-2026',
}


def apply(root=ROOT, check=False):
    manifest = json.loads((root / MANIFEST_PATH).read_text(encoding='utf-8'))
    if manifest.get('schema') != 1:
        raise ValueError('Unsupported Russian translation manifest schema')

    path = root / TEXT_PATH
    original = json.loads(path.read_text(encoding='utf-8'))
    data = json.loads(path.read_text(encoding='utf-8'))
    sections = {section['ref']: section for section in data['sections']}

    seen = set()
    changed = 0
    target_count = 0
    for entry in manifest['translations']:
        ru = entry.get('ru', '').strip()
        he = entry.get('he', '')
        edition = entry.get('translationEdition')
        reference = entry.get('translationRef')
        if not he or not ru or not edition or not reference:
            raise ValueError('Russian manifest contains an incomplete translation record')

        for section_ref, paragraph_index in entry['targets']:
            key = (section_ref, paragraph_index)
            if key in seen:
                raise ValueError(f'Duplicate Russian target: {key}')
            seen.add(key)
            target_count += 1

            section = sections.get(section_ref)
            if section is None:
                raise ValueError(f'Missing Ashkenaz section: {section_ref}')
            try:
                paragraph = section['paragraphs'][paragraph_index]
            except IndexError as exc:
                raise ValueError(f'Missing Ashkenaz paragraph: {key}') from exc
            if paragraph.get('he') != he:
                raise ValueError(f'Hebrew source changed at {key}')
            if paragraph.get('ru') and paragraph['ru'] != ru:
                raise ValueError(f'Different Russian translation already exists at {key}')

            desired = (ru, edition, reference)
            actual = (
                paragraph.get('ru'),
                paragraph.get('translationEditions', {}).get('ru'),
                paragraph.get('translationRefs', {}).get('ru'),
            )
            if actual != desired:
                changed += 1
            paragraph['ru'] = ru
            paragraph.setdefault('translationEditions', {})['ru'] = edition
            paragraph.setdefault('translationRefs', {})['ru'] = reference

    if target_count != manifest.get('targetCount'):
        raise ValueError(f'Russian target count mismatch: {target_count} != {manifest.get("targetCount")}')

    data['sources'] = [source for source in data.get('sources', [])
                       if source.get('id') not in OBSOLETE_EDITIONS]
    required_identities = {(source.get('id'), source.get('language')) for source in manifest['sources']}
    data['sources'] = [
        source for source in data['sources']
        if (source.get('id'), source.get('language')) not in required_identities
    ]
    data['sources'].extend(manifest['sources'])

    missing = sum(
        bool(paragraph.get('he', '').strip()) and not paragraph.get('ru', '').strip()
        for section in data['sections'] for paragraph in section['paragraphs']
    )
    if missing:
        raise ValueError(f'Russian Ashkenaz corpus is incomplete: {missing} passages remain')

    if check:
        if data != original:
            raise ValueError('Unified Russian translations or metadata need reapplying')
    else:
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

    return {
        'translationRecords': len(manifest['translations']),
        'targets': target_count,
        'changed': changed,
        'remainingRussianGaps': missing,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    print(json.dumps(apply(args.root, args.check), ensure_ascii=False, indent=2))
