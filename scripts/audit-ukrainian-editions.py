#!/usr/bin/env python3
"""Exhaustive structural/provenance audit for the four Ukrainian Tanakh choices.

This is intentionally offline and deterministic.  It verifies every displayed
Hebrew verse against every Ukrainian bundle and proves that the Jewish-modern
preset is the intended Varda/Turkonjak composite rather than a silent fallback.
"""
from __future__ import annotations
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TANAKH_DIR = ROOT / 'public' / 'texts' / 'translations' / 'tanakh'
IDS = ('uk-jewish-modern','uk-ohienko-1962','uk-turkonjak-utt','uk-kulish-puluj-1905')
TORAH = {'genesis','exodus','leviticus','numbers','deuteronomy'}


def record_text(record):
    return record if isinstance(record, str) else (record or {}).get('text','')

def record_meta(record):
    return record if isinstance(record, dict) else {}

def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

def main():
    catalog = load_json(ROOT/'public/texts/catalog.json')
    books = catalog['books']
    expected = {}
    total = 0
    for info in books:
        base = load_json(ROOT/'public/texts'/f"{info['id']}.json")
        shape = [len(ch) for ch in base['text']]
        expected[info['id']] = shape
        total += sum(shape)
    if len(books) != 39 or total != 23206:
        raise ValueError(f'Unexpected Hebrew Tanakh shape: {len(books)} books / {total} verses')

    bundles = {i: load_json(TANAKH_DIR/f'{i}.json') for i in IDS}
    varda = load_json(TANAKH_DIR/'uk-varda-torah.json')
    report = {'schema':1,'expected':{'books':39,'verses':23206},'editions':{},'jewishModern':{}}

    for edition, data in bundles.items():
        problems=[]; verse_count=0; empty=0; metadata=Counter(); fallback=Counter(); by_book={}
        if data.get('schema') != 1 or data.get('language') != 'uk' or data.get('edition') != edition:
            problems.append('invalid bundle header')
        if set(data.get('books',{})) != set(expected):
            problems.append('book set differs from Hebrew catalog')
        for book, shape in expected.items():
            item=data.get('books',{}).get(book,{})
            chapters=item.get('chapters',[])
            if [len(ch) for ch in chapters] != shape:
                problems.append(f'{book}: chapter/verse shape mismatch')
                continue
            bcount=0
            for ch in chapters:
                for record in ch:
                    verse_count += 1; bcount += 1
                    text=record_text(record).strip()
                    if not text: empty += 1
                    meta=record_meta(record)
                    if meta.get('ref'): metadata['ref'] += 1
                    if meta.get('edition'): metadata['edition'] += 1
                    if meta.get('note'): metadata['note'] += 1
                    if meta.get('edition') and meta.get('edition') != edition:
                        fallback[meta['edition']] += 1
            by_book[book]=bcount
        if verse_count != 23206: problems.append(f'verse count {verse_count} != 23206')
        if empty: problems.append(f'{empty} empty verse records')
        report['editions'][edition]={'verses':verse_count,'empty':empty,'metadata':dict(metadata),'embeddedEditions':dict(fallback),'books':by_book,'problems':problems}
        if problems: raise ValueError(f'{edition}: ' + '; '.join(problems))

    # Prove the composite, including metadata, verse by verse.
    mismatches=[]; provenance=Counter(); fallback_refs=[]
    jm=bundles['uk-jewish-modern']; tur=bundles['uk-turkonjak-utt']
    for book in expected:
        source = varda if book in TORAH else tur
        for ci,(actual_ch, source_ch) in enumerate(zip(jm['books'][book]['chapters'],source['books'][book]['chapters']),1):
            for vi,(actual, wanted) in enumerate(zip(actual_ch,source_ch),1):
                atext, wtext = record_text(actual), record_text(wanted)
                ameta, wmeta = record_meta(actual), record_meta(wanted)
                comparable_a = (atext, ameta.get('ref',''), ameta.get('note',''))
                comparable_w = (wtext, wmeta.get('ref',''), wmeta.get('note',''))
                if comparable_a != comparable_w:
                    mismatches.append(f'{book} {ci}:{vi}')
                    if len(mismatches)>=20: break
                meta=ameta
                effective=meta.get('edition') or wmeta.get('edition') or source['edition']
                provenance[effective]+=1
                if book not in TORAH and effective=='uk-ohienko-1962':
                    fallback_refs.append({'book':book,'chapter':ci,'verse':vi,'ref':meta.get('ref',''),'note':meta.get('note','')})
            if len(mismatches)>=20: break
        if len(mismatches)>=20: break
    if mismatches: raise ValueError('Jewish-modern composite mismatch: '+', '.join(mismatches))
    report['jewishModern']={
        'exactComposite':True,
        'torahComponent':'uk-varda-torah',
        'neviimKetuvimComponent':'uk-turkonjak-utt',
        'effectiveVerseProvenance':dict(provenance),
        'explicitTurkonjakFallbackCount':len(fallback_refs),
        'explicitTurkonjakFallbacks':fallback_refs,
    }
    out=ROOT/'.text-cache'/'audits'/'ukrainian-edition-audit.json';out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({
        'books':39,'verses':23206,
        'editions':{k:{'verses':v['verses'],'empty':v['empty'],'embeddedEditions':v['embeddedEditions']} for k,v in report['editions'].items()},
        'jewishModern':{'exactComposite':True,'provenance':dict(provenance),'fallbacks':len(fallback_refs)},
        'report':str(out.relative_to(ROOT)),
    },ensure_ascii=False,indent=2))

if __name__=='__main__': main()
