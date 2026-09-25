#!/usr/bin/env python3
"""Validate split Siddur translation files against the Hebrew corpora."""
import json
from pathlib import Path
from siddur_translation_io import LANGUAGES, load_siddur, validate

ROOT = Path(__file__).resolve().parents[1]


def main():
    totals = validate(ROOT)
    translations_dir = ROOT / 'public' / 'texts' / 'translations'
    expected_files = {f'{language}.json' for language in LANGUAGES}
    actual_files = {path.name for path in translations_dir.glob('*.json')}
    if actual_files != expected_files:
        raise ValueError(f'Expected exactly one Siddur translation file per language: {sorted(actual_files)}')

    # Repair manifests may describe Hebrew/reading fixes, but must not become a
    # second storage location for Siddur translation prose.
    repairs = json.loads((ROOT / 'scripts' / 'translations' / 'content-repairs.json').read_text(encoding='utf-8'))
    translation_fields = {'en', 'ru', 'uk', 'translationRefs', 'translationEditions', 'translationNotes'}
    for index, repair in enumerate(repairs):
        if translation_fields & set(repair.get('before', {})) or translation_fields & set(repair.get('after', {})):
            raise ValueError(f'content-repairs.json duplicates translation data at entry {index}')

    paragraph_totals = {}
    for nusach in ('ashkenaz', 'edot'):
        data = load_siddur(ROOT, nusach, ())
        paragraph_totals[nusach] = sum(len(section['paragraphs']) for section in data['sections'])
    if totals['ru']['ashkenaz'] != paragraph_totals['ashkenaz']:
        raise ValueError(
            f'Russian Ashkenaz translation incomplete: {totals["ru"]["ashkenaz"]} '
            f'of {paragraph_totals["ashkenaz"]}'
        )
    print(json.dumps({
        'schema': 1,
        'paragraphs': paragraph_totals,
        'translated': totals,
        'files': [f'public/texts/translations/{language}.json' for language in LANGUAGES],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
