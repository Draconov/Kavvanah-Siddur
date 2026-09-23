#!/usr/bin/env python3
"""Apply reviewed, exact-Hebrew content repairs without shifting paragraph IDs."""
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def apply_repairs(data,corpus,strict=False):
    repairs=json.loads((ROOT/'scripts/translations/content-repairs.json').read_text())
    count=0
    for entry in repairs:
        if entry['corpus']!=corpus:continue
        matches=[p for s in data['sections'] if s['ref']==entry['section'] for p in s['paragraphs'] if p['he']==entry['he']]
        if not matches:
            if strict:raise ValueError('Repair source not found: '+entry['section'])
            continue
        for p in matches:
            for field,value in entry['after'].items():
                if p.get(field) not in [entry['before'][field],value]:
                    raise ValueError('Repair would overwrite changed content: '+entry['section']+' '+field)
                if p.get(field)!=value:p[field]=value;count+=1
    for language in ['en','ru','uk']:
        if any(p.get('translationEditions',{}).get(language)=='kavvanah-supplement-2026' for s in data['sections'] for p in s['paragraphs']) and not any(s.get('id')=='kavvanah-supplement-2026' and s['language']==language for s in data['sources']):
            data['sources'].append({'id':'kavvanah-supplement-2026','title':'Kavvanah','version':'Kavvanah supplementary translations (2026)','language':language,'license':'','url':'/'})
    return count

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    for name in ['ashkenaz','edot']:
        path=ROOT/f'public/texts/{name}.json';data=json.loads(path.read_text());before=json.dumps(data,ensure_ascii=False);changes=apply_repairs(data,name,strict=True)
        if args.check:
            if json.dumps(data,ensure_ascii=False)!=before:raise ValueError(name+': unapplied repairs')
        else:path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
        print(name,changes,'field changes')
