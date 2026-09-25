#!/usr/bin/env python3
"""Read and write the split Siddur translation files.

Hebrew structure lives in public/texts/{ashkenaz,edot}.json. Each Siddur
translation language lives once in public/texts/translations/<lang>.json.
Maintenance scripts can hydrate that split representation into the historical
in-memory paragraph shape, then write it back without duplicating translations
in the Hebrew corpus files.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path

LANGUAGES = ('en', 'ru', 'uk')
SCHEMA = 1


def translation_path(root: Path, language: str) -> Path:
    return root / 'public' / 'texts' / 'translations' / f'{language}.json'


def _record_from_paragraph(paragraph: dict, language: str):
    text = paragraph.get(language)
    if not isinstance(text, str) or not text.strip():
        return None
    record = {'text': text}
    reference = paragraph.get('translationRefs', {}).get(language)
    edition = paragraph.get('translationEditions', {}).get(language)
    note = paragraph.get('translationNotes', {}).get(language)
    if reference:
        record['ref'] = reference
    if edition:
        record['edition'] = edition
    if note:
        record['note'] = note
    return text if len(record) == 1 else record


def _apply_record(paragraph: dict, language: str, record) -> None:
    if record is None:
        return
    if isinstance(record, str):
        text = record
        meta = {}
    elif isinstance(record, dict) and isinstance(record.get('text'), str):
        text = record['text']
        meta = record
    else:
        raise ValueError(f'Invalid {language} translation record')
    if not text.strip():
        raise ValueError(f'Empty {language} translation record')
    paragraph[language] = text
    for source_key, target_key in (
        ('ref', 'translationRefs'),
        ('edition', 'translationEditions'),
        ('note', 'translationNotes'),
    ):
        value = meta.get(source_key)
        if value:
            paragraph.setdefault(target_key, {})[language] = value


def section_hash(section: dict) -> str:
    identity = [(paragraph.get('kind', 'prayer'), paragraph['he']) for paragraph in section['paragraphs']]
    payload = json.dumps(identity, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(payload).hexdigest()[:16]


def extract_corpus(data: dict, language: str) -> dict:
    sections = {}
    for section in data['sections']:
        records = [_record_from_paragraph(paragraph, language) for paragraph in section['paragraphs']]
        if any(record is not None for record in records):
            sections[section['id']] = {'sourceHash': section_hash(section), 'paragraphs': records}
    return {
        'sources': [deepcopy(source) for source in data.get('sources', []) if source.get('language') == language],
        'sections': sections,
    }


def strip_translations(data: dict) -> dict:
    base = deepcopy(data)
    base['sources'] = [source for source in base.get('sources', []) if source.get('language') not in LANGUAGES]
    for section in base['sections']:
        for paragraph in section['paragraphs']:
            for language in LANGUAGES:
                paragraph.pop(language, None)
                for field in ('translationRefs', 'translationEditions', 'translationNotes'):
                    mapping = paragraph.get(field)
                    if mapping:
                        mapping.pop(language, None)
                        if not mapping:
                            paragraph.pop(field, None)
    return base


def read_bundle(root: Path, language: str) -> dict:
    path = translation_path(root, language)
    if not path.exists():
        return {'schema': SCHEMA, 'language': language, 'corpora': {}}
    bundle = json.loads(path.read_text(encoding='utf-8'))
    if bundle.get('schema') != SCHEMA or bundle.get('language') != language or not isinstance(bundle.get('corpora'), dict):
        raise ValueError(f'Unsupported Siddur translation file: {path}')
    return bundle


def apply_bundle(data: dict, language: str, bundle: dict) -> dict:
    corpus = bundle.get('corpora', {}).get(data['nusach'])
    if corpus is None:
        return data
    by_id = {section['id']: section for section in data['sections']}
    for section_id, entry in corpus.get('sections', {}).items():
        section = by_id.get(section_id)
        if section is None:
            raise ValueError(f'{language}: unknown section id {section_id} in {data["nusach"]}')
        if not isinstance(entry, dict) or not isinstance(entry.get('paragraphs'), list):
            raise ValueError(f'{language}: invalid section translation entry {section_id}')
        if entry.get('sourceHash') != section_hash(section):
            raise ValueError(f'{language}: Hebrew source changed for {data["nusach"]}:{section_id}')
        records = entry['paragraphs']
        if len(records) != len(section['paragraphs']):
            raise ValueError(
                f'{language}: paragraph count changed for {data["nusach"]}:{section_id} '
                f'({len(records)} != {len(section["paragraphs"])})'
            )
        for paragraph, record in zip(section['paragraphs'], records):
            _apply_record(paragraph, language, record)
    data['sources'].extend(deepcopy(corpus.get('sources', [])))
    return data


def preserve_existing_editions(root: Path, nusach: str, data: dict, language: str, editions) -> dict:
    """Reapply selected canonical records before regenerating a source-derived bundle.

    This keeps project-authored supplemental translations in the one canonical
    per-language file while allowing public-source importers to refresh the
    source-derived portion without duplicating translation prose in repair files.
    """
    editions = set(editions)
    bundle = read_bundle(root, language)
    corpus = bundle.get('corpora', {}).get(nusach)
    if not corpus:
        return data
    by_id = {section['id']: section for section in data['sections']}
    for section_id, entry in corpus.get('sections', {}).items():
        section = by_id.get(section_id)
        if section is None or entry.get('sourceHash') != section_hash(section):
            continue
        records = entry.get('paragraphs', [])
        if len(records) != len(section['paragraphs']):
            continue
        for paragraph, record in zip(section['paragraphs'], records):
            if isinstance(record, dict) and record.get('edition') in editions:
                _apply_record(paragraph, language, record)
    known = {(source.get('id'), source.get('language')) for source in data.get('sources', [])}
    for source in corpus.get('sources', []):
        if source.get('id') in editions and (source.get('id'), source.get('language')) not in known:
            data.setdefault('sources', []).append(deepcopy(source))
            known.add((source.get('id'), source.get('language')))
    return data


def load_siddur(root: Path, nusach: str, languages=LANGUAGES) -> dict:
    path = root / 'public' / 'texts' / f'{nusach}.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    for language in languages:
        apply_bundle(data, language, read_bundle(root, language))
    return data


def save_siddur(root: Path, nusach: str, data: dict, languages=LANGUAGES) -> None:
    translations_dir = root / 'public' / 'texts' / 'translations'
    translations_dir.mkdir(parents=True, exist_ok=True)
    for language in languages:
        bundle = read_bundle(root, language)
        bundle['corpora'][nusach] = extract_corpus(data, language)
        translation_path(root, language).write_text(
            json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + '\n',
            encoding='utf-8',
        )
    base = strip_translations(data)
    (root / 'public' / 'texts' / f'{nusach}.json').write_text(
        json.dumps(base, ensure_ascii=False, separators=(',', ':')) + '\n',
        encoding='utf-8',
    )


def validate(root: Path) -> dict:
    totals = {language: {} for language in LANGUAGES}
    for nusach in ('ashkenaz', 'edot'):
        base_path = root / 'public' / 'texts' / f'{nusach}.json'
        base = json.loads(base_path.read_text(encoding='utf-8'))
        for section in base['sections']:
            for paragraph in section['paragraphs']:
                for language in LANGUAGES:
                    if language in paragraph:
                        raise ValueError(f'{base_path}: embedded {language} translation remains')
                    for field in ('translationRefs', 'translationEditions', 'translationNotes'):
                        if language in paragraph.get(field, {}):
                            raise ValueError(f'{base_path}: embedded {language} metadata remains')
        for language in LANGUAGES:
            hydrated = load_siddur(root, nusach, (language,))
            paragraphs = [p for s in hydrated['sections'] for p in s['paragraphs']]
            totals[language][nusach] = sum(bool(p.get(language, '').strip()) for p in paragraphs)
    return totals
