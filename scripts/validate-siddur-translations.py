#!/usr/bin/env python3
"""Validate split Siddur translation files against the Hebrew corpora."""
import argparse
import json
import unicodedata
import re
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from siddur_translation_io import LANGUAGES, load_siddur, validate

ROOT = Path(__file__).resolve().parents[1]


def ukrainian_quality_audit():
    """Produce a live worklist and heuristic short-alignment warnings."""
    report={'language':'uk','warning':'Populated fields are not proof of translation quality.','corpora':{}}
    for nusach in ('ashkenaz','edot'):
        data=load_siddur(ROOT,nusach,languages=('uk',))
        missing,short=[],[]
        total=0
        for sec in data['sections']:
            for i,p in enumerate(sec['paragraphs']):
                total+=1
                locator={'sectionId':sec['id'],'index':i,'title':sec['title']}
                uk=p.get('uk','').strip()
                if not uk:
                    missing.append({**locator,'hePreview':p['he'][:120]})
                elif len(p['he'])>=150 and len(uk)/len(p['he'])<.30:
                    short.append({**locator,'heLength':len(p['he']),'ukLength':len(uk)})
        report['corpora'][nusach]={'total':total,'filled':total-len(missing),'missing':len(missing),
                                   'suspiciousShortTranslations':short,'untranslated':missing}
    return report


def _normalized_hebrew(value):
    plain=''.join(ch for ch in unicodedata.normalize('NFD',value)
                  if unicodedata.category(ch)!='Mn')
    return re.sub('[^\u05d0-\u05ea]','',plain)


def ukrainian_semantic_audit():
    """Spot collisions; these heuristics cannot certify semantic accuracy."""
    rows=[]
    for n in ('ashkenaz','edot'):
        data=load_siddur(ROOT,n,languages=('uk',))
        for sec in data['sections']:
            for i,p in enumerate(sec['paragraphs']):
                rows.append({'nusach':n,'sectionId':sec['id'],'index':i,'title':sec['title'],
                             'he':_normalized_hebrew(p['he']),'uk':p.get('uk','').strip()})
    by_uk,by_prefix=defaultdict(list),defaultdict(list)
    for row in rows:
        if len(row['he'])>=60 and len(row['uk'])>=70:
            by_uk[row['uk']].append(row)
        if len(row['he'])>=85:
            by_prefix[row['he'][:25]].append(row)
    def locator(row):
        return {key:row[key] for key in ('nusach','sectionId','index','title')}
    collisions=[]
    for group in by_uk.values():
        vals=list({r['he']:r for r in group}.values())
        for i,a in enumerate(vals):
            for b in vals[i+1:]:
                similarity=SequenceMatcher(None,a['he'][:480],b['he'][:480],autojunk=False).ratio()
                if similarity<.5:
                    collisions.append({'first':locator(a),'second':locator(b),
                                       'similarity':round(similarity,3),'ukPreview':a['uk'][:100]})
    discrepancies=[]
    for group in by_prefix.values():
        if len(group)>25: continue
        for i,a in enumerate(group):
            for b in group[i+1:]:
                longer=max(len(a['uk']),len(b['uk']))
                ratio=longer/max(1,min(len(a['uk']),len(b['uk'])))
                if ratio<2 or longer<200 or not .7<=len(b['he'])/len(a['he'])<=1.4:
                    continue
                similarity=SequenceMatcher(None,a['he'][:350],b['he'][:350],autojunk=False).ratio()
                if similarity>.85:
                    discrepancies.append({'first':locator(a),'second':locator(b),
                                          'heSimilarity':round(similarity,3),
                                          'ukLengthRatio':round(ratio,2)})
    return {'language':'uk','paragraphsExamined':len(rows),
            'notice':'Heuristics are not a substitute for specialist proofreading.',
            'identicalUkrainianOnUnrelatedHebrew':collisions,
            'similarHebrewDivergentUkrainianLengths':discrepancies}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-uk',action='store_true',
                        help='Include live Ukrainian short-translation and semantic checks')
    args=parser.parse_args()
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
    output={
        'schema': 1,
        'paragraphs': paragraph_totals,
        'translated': totals,
        'files': [f'public/texts/translations/{language}.json' for language in LANGUAGES],
    }
    if args.audit_uk:
        output['ukrainianQuality']=ukrainian_quality_audit()
        output['ukrainianSemantic']=ukrainian_semantic_audit()
    print(json.dumps(output,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
