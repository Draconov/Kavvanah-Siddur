#!/usr/bin/env python3
"""Apply reviewed, exact-Hebrew content repairs without shifting paragraph IDs."""
import argparse,json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from siddur_translation_io import load_siddur, save_siddur
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
    return count

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    for name in ['ashkenaz','edot']:
        data=load_siddur(ROOT,name);before=json.dumps(data,ensure_ascii=False,sort_keys=True);changes=apply_repairs(data,name,strict=True)
        if args.check:
            if json.dumps(data,ensure_ascii=False,sort_keys=True)!=before:raise ValueError(name+': unapplied repairs')
        else:save_siddur(ROOT,name,data)
        print(name,changes,'field changes')
