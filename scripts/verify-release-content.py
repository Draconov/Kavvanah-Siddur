#!/usr/bin/env python3
"""Fail a release if a published Siddur or Tanakh text is missing or misaligned.

The Siddur source-hash/paragraph alignment is checked by siddur_translation_io;
this script also verifies the complete reader catalog and Tanakh editions.
No external Python dependencies, no changes to source text.
"""
from __future__ import annotations

import json
from pathlib import Path

from siddur_translation_io import LANGUAGES, load_siddur, validate

ROOT = Path(__file__).resolve().parents[1]
TEXTS = ROOT / 'public' / 'texts'
NUSACH = ('ashkenaz', 'edot')
TORAH = ('genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy')
UK_EDITIONS = (
    'uk-jewish-modern',
    'uk-turkonjak-utt',
    'uk-ohienko-1962',
    'uk-kulish-puluj-1905',
)


def read(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def require(condition: bool, message: str):
    if not condition:
        raise ValueError(message)


def record_text(record):
    if isinstance(record, str):
        return record
    if isinstance(record, dict):
        return record.get('text')
    return None


def verify(root: Path = ROOT) -> dict:
    texts = root / 'public' / 'texts'
    counts = validate(root)  # sourceHash, section ID, paragraph order, metadata isolation
    prayers = {}
    for nusach in NUSACH:
        corpus = load_siddur(root, nusach, LANGUAGES)
        paragraphs = [p for section in corpus['sections'] for p in section['paragraphs']]
        require(len({s['id'] for s in corpus['sections']}) == len(corpus['sections']),
                f'{nusach}: duplicate section IDs')
        for lang in LANGUAGES:
            require(counts[lang][nusach] == len(paragraphs),
                    f'{lang}/{nusach}: incomplete translation ({counts[lang][nusach]}/{len(paragraphs)})')
        prayers[nusach] = len(paragraphs)

    expected = {f'{lang}.json' for lang in LANGUAGES}
    actual = {p.name for p in (texts / 'translations').glob('*.json')}
    require(actual == expected, f'Unexpected canonical translation files: {sorted(actual ^ expected)}')

    catalog = read(texts / 'catalog.json')
    books = catalog['books']
    book_ids = [book['id'] for book in books]
    require(len(book_ids) == len(set(book_ids)) == 39, 'Tanakh catalog must contain 39 unique books')
    base_lengths = {}
    total_verses = 0
    for book in books:
        name = book['id']
        data = read(texts / f'{name}.json')
        require(data['id'] == name, f'{name}: wrong book ID')
        chapters = data['text']
        require(len(chapters) == book['chapters'], f'{name}: chapter-count mismatch')
        base_lengths[name] = [len(ch) for ch in chapters]
        for ci, chapter in enumerate(chapters, 1):
            require(chapter, f'{name} {ci}: empty chapter')
            for vi, verse in enumerate(chapter, 1):
                for lang in ('he', 'en', 'ru', 'uk'):
                    require(isinstance(verse.get(lang), str) and verse[lang].strip(),
                            f'{name} {ci}:{vi}: missing {lang} base text')
                total_verses += 1
    require(total_verses == 23206, f'Tanakh verse total changed: {total_verses}')

    editions = {}
    for edition in (*UK_EDITIONS, 'uk-varda-torah'):
        data = read(texts / 'translations' / 'tanakh' / f'{edition}.json')
        require(data.get('schema') == 1 and data.get('language') == 'uk' and data.get('edition') == edition,
                f'{edition}: malformed header')
        selected = list(TORAH) if edition == 'uk-varda-torah' else book_ids
        require(set(data['books']) == set(selected), f'{edition}: book selection mismatch')
        count = 0
        for book_id in selected:
            chapters = data['books'][book_id]['chapters']
            lengths = base_lengths[book_id]
            require(len(chapters) == len(lengths), f'{edition}/{book_id}: chapter mismatch')
            for ci, (chapter, expected_count) in enumerate(zip(chapters, lengths), 1):
                require(len(chapter) == expected_count,
                        f'{edition}/{book_id} {ci}: verse alignment mismatch')
                for vi, verse in enumerate(chapter, 1):
                    translation = record_text(verse)
                    require(isinstance(translation, str) and translation.strip(),
                            f'{edition}/{book_id} {ci}:{vi}: missing verse text')
                    count += 1
        expected_count = 5846 if edition == 'uk-varda-torah' else total_verses
        require(count == expected_count, f'{edition}: {count}/{expected_count} translated verses')
        editions[edition] = count

    return {
        'status': 'passed',
        'siddur': {'paragraphsByTradition': prayers, 'populatedByLanguage': counts},
        'tanakh': {'books': len(books), 'versesPerBaseLanguage': total_verses,
                   'baseLanguages': ['he', 'en', 'ru', 'uk'], 'ukrainianEditions': editions},
    }


if __name__ == '__main__':
    print(json.dumps(verify(), ensure_ascii=False, indent=2))
