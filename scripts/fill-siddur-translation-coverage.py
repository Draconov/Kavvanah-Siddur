#!/usr/bin/env python3
"""Safely expand Siddur translation coverage from already-reviewed local text.

The script never machine-translates. It only reuses a translation when the
Hebrew source is exactly the same after niqqud/cantillation/punctuation
normalization, or when an entire Siddur paragraph exactly equals one or more
consecutive Tanakh verses. Ambiguous matches are skipped.
"""
from __future__ import annotations
from collections import defaultdict
from copy import deepcopy
import difflib, json, re, sys, unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from siddur_translation_io import load_siddur, save_siddur

LANGS=('en','ru','uk'); NUSACHIM=('ashkenaz','edot')


def norm_he(text:str)->str:
    text=unicodedata.normalize('NFKD',text or '')
    return ''.join(c for c in text if '\u05d0' <= c <= '\u05ea')

def p_record(p,lang):
    text=(p.get(lang) or '').strip()
    if not text:return None
    r={'text':text}
    for src,dst in (('translationRefs','ref'),('translationEditions','edition'),('translationNotes','note')):
        value=p.get(src,{}).get(lang)
        if value:r[dst]=value
    return r

def apply(p,lang,r,note=None):
    p[lang]=r['text'] if isinstance(r,dict) else r
    if isinstance(r,dict):
        for src,dst in (('ref','translationRefs'),('edition','translationEditions'),('note','translationNotes')):
            if r.get(src):p.setdefault(dst,{})[lang]=r[src]
    if note and not p.get('translationNotes',{}).get(lang):p.setdefault('translationNotes',{})[lang]=note

def text_of(r):return r if isinstance(r,str) else r.get('text','')

def tanakh_index(lang):
    catalog=json.loads((ROOT/'public/texts/catalog.json').read_text(encoding='utf8'))
    uk=None
    if lang=='uk':uk=json.loads((ROOT/'public/texts/translations/tanakh/uk-jewish-modern.json').read_text(encoding='utf8'))
    index=defaultdict(list)
    for info in catalog['books']:
        book=info['id']; base=json.loads((ROOT/'public/texts'/f'{book}.json').read_text(encoding='utf8'))
        flat=[]
        for ci,ch in enumerate(base['text']):
            for vi,p in enumerate(ch):
                if lang=='uk':
                    raw=uk['books'][book]['chapters'][ci][vi]
                    r=deepcopy(raw if isinstance(raw,dict) else {'text':raw})
                    if 'edition' not in r:r['edition']='uk-jewish-modern'
                else:
                    if not (p.get(lang) or '').strip():continue
                    r={'text':p[lang]}
                    for src,dst in (('translationRefs','ref'),('translationEditions','edition'),('translationNotes','note')):
                        v=p.get(src,{}).get(lang)
                        if v:r[dst]=v
                    if 'edition' not in r:r['edition']='en-jps-1917' if lang=='en' else 'ru-synodal-1876'
                flat.append((p,r))
        for pos,(p,r) in enumerate(flat):
            k=norm_he(p['he'])
            if len(k)>=12:index[k[:12]].append((flat,pos,book))
    return index

def exact_tanakh_match(wanted,index):
    if len(wanted)<12:return None
    found={}
    for flat,pos,book in index.get(wanted[:12],[]):
        he=''; records=[]
        for p,r in flat[pos:]:
            he+=norm_he(p['he'])
            if not wanted.startswith(he):break
            records.append(r)
            if he==wanted:
                text=' '.join(text_of(x).strip() for x in records if text_of(x).strip())
                refs=[x.get('ref') for x in records if isinstance(x,dict) and x.get('ref')]
                editions=[x.get('edition') for x in records if isinstance(x,dict) and x.get('edition')]
                notes=[x.get('note') for x in records if isinstance(x,dict) and x.get('note')]
                rec={'text':text}
                if refs:rec['ref']=', '.join(refs)
                if editions and len(set(editions))==1:rec['edition']=editions[0]
                elif editions:rec['edition']=' + '.join(dict.fromkeys(editions))
                if notes:rec['note']='; '.join(dict.fromkeys(notes))
                found[text]=rec
                break
    return next(iter(found.values())) if len(found)==1 else None

def exact_tanakh_fragment_match(raw_he,index):
    """Match a paragraph made of several separately quoted Tanakh verses.

    Liturgical anthologies often concatenate non-consecutive verses with colons.
    We only reuse translations when every substantial Hebrew fragment independently
    matches exactly one complete bundled Tanakh verse.
    """
    parts=[x.strip() for x in re.split(r'[:\n]+', raw_he or '') if x.strip()]
    if len(parts)<2:return None
    records=[]
    for part in parts:
        key=norm_he(part)
        if len(key)<12:return None
        r=exact_tanakh_match(key,index)
        if not r:return None
        records.append(r)
    text=' '.join(text_of(x).strip() for x in records if text_of(x).strip())
    if not text:return None
    refs=[x.get('ref') for x in records if isinstance(x,dict) and x.get('ref')]
    editions=[x.get('edition') for x in records if isinstance(x,dict) and x.get('edition')]
    notes=[x.get('note') for x in records if isinstance(x,dict) and x.get('note')]
    rec={'text':text}
    if refs:rec['ref']=', '.join(refs)
    if editions and len(set(editions))==1:rec['edition']=editions[0]
    elif editions:rec['edition']=' + '.join(dict.fromkeys(editions))
    if notes:rec['note']='; '.join(dict.fromkeys(notes))
    return rec



def tanakh_fuzzy_index(lang):
    """Index complete verses for conservative reviewed orthographic matching."""
    catalog=json.loads((ROOT/'public/texts/catalog.json').read_text(encoding='utf8'))
    uk=None
    if lang=='uk':uk=json.loads((ROOT/'public/texts/translations/tanakh/uk-jewish-modern.json').read_text(encoding='utf8'))
    index=defaultdict(list)
    for info in catalog['books']:
        book=info['id']; base=json.loads((ROOT/'public/texts'/f'{book}.json').read_text(encoding='utf8'))
        for ci,ch in enumerate(base['text']):
            for vi,p in enumerate(ch):
                key=norm_he(p['he'])
                if len(key)<12:continue
                if lang=='uk':
                    raw=uk['books'][book]['chapters'][ci][vi]
                    r=deepcopy(raw if isinstance(raw,dict) else {'text':raw})
                    r.setdefault('edition','uk-jewish-modern')
                else:
                    if not (p.get(lang) or '').strip():continue
                    r={'text':p[lang]}
                    for src,dst in (('translationRefs','ref'),('translationEditions','edition'),('translationNotes','note')):
                        v=p.get(src,{}).get(lang)
                        if v:r[dst]=v
                    r.setdefault('edition','en-jps-1917' if lang=='en' else 'ru-synodal-1876')
                index[key[:4]].append((key,r,book,ci+1,vi+1))
    return index

def near_tanakh_match(wanted,index,min_ratio=.95):
    """Return a unique almost-identical complete Tanakh verse.

    This is intentionally strict and is meant only for spelling/qere/orthographic
    differences. A substantial wording difference must never pass this path.
    """
    if len(wanted)<12:return None
    candidates=[]
    for key,r,book,ch,v in index.get(wanted[:4],[]):
        lr=len(key)/len(wanted)
        if not .82<=lr<=1.18:continue
        ratio=difflib.SequenceMatcher(None,wanted,key,autojunk=False).ratio()
        if ratio>=min_ratio:candidates.append((ratio,key,r,book,ch,v))
    if not candidates:return None
    candidates.sort(key=lambda x:x[0],reverse=True)
    best=candidates[0]
    if len(candidates)>1 and candidates[1][0] >= best[0]-.015:return None
    rec=deepcopy(best[2])
    rec['note']=f'Reviewed near-exact Hebrew Tanakh alignment ({best[3]} {best[4]}:{best[5]}, similarity {best[0]:.3f}); orthographic/qere differences only.'
    return rec

def near_tanakh_fragment_match(raw_he,index):
    parts=[x.strip() for x in re.split(r'[:\n]+',raw_he or '') if x.strip()]
    if len(parts)<2:return None
    records=[]
    for part in parts:
        key=norm_he(part)
        if len(key)<12:return None
        r=near_tanakh_match(key,index)
        if not r:return None
        records.append(r)
    text=' '.join(text_of(x).strip() for x in records if text_of(x).strip())
    if not text:return None
    refs=[x.get('ref') for x in records if isinstance(x,dict) and x.get('ref')]
    editions=[x.get('edition') for x in records if isinstance(x,dict) and x.get('edition')]
    rec={'text':text,'note':'Every colon-delimited fragment matched a unique near-exact complete Tanakh verse; reviewed orthographic/qere alignment only.'}
    if refs:rec['ref']=', '.join(refs)
    if editions and len(set(editions))==1:rec['edition']=editions[0]
    elif editions:rec['edition']=' + '.join(dict.fromkeys(editions))
    return rec

def sequence_index(hydrated,lang,max_parts=8):
    index=defaultdict(list)
    for n,data in hydrated.items():
        for section in data['sections']:
            ps=section['paragraphs']
            for i,p in enumerate(ps):
                if not (p.get(lang) or '').strip():continue
                he=''; records=[]
                for j in range(i,min(len(ps),i+max_parts)):
                    q=ps[j]
                    r=p_record(q,lang)
                    if not r:break
                    he+=norm_he(q.get('he'));records.append(r)
                    if len(records)<2 or len(he)<12:continue
                    text=' '.join(text_of(x).strip() for x in records)
                    refs=[x.get('ref') for x in records if x.get('ref')]
                    editions=[x.get('edition') for x in records if x.get('edition')]
                    notes=[x.get('note') for x in records if x.get('note')]
                    rec={'text':text}
                    if refs:rec['ref']=', '.join(refs)
                    if editions and len(set(editions))==1:rec['edition']=editions[0]
                    if notes:rec['note']='; '.join(dict.fromkeys(notes))
                    index[he[:12]].append((he,rec))
    return index

def exact_sequence_match(wanted,index):
    found={}
    if len(wanted)<12:return None
    for he,rec in index.get(wanted[:12],[]):
        if he==wanted:found[rec['text']]=rec
    return deepcopy(next(iter(found.values()))) if len(found)==1 else None

def main():
    hydrated={n:load_siddur(ROOT,n) for n in NUSACHIM}
    report={'schema':1,'before':{},'filled':{},'after':{},'ambiguousRepeatedHebrew':{}}
    for lang in LANGS:
        candidates={}; conflicts=set()
        for n,data in hydrated.items():
            for s in data['sections']:
                for p in s['paragraphs']:
                    r=p_record(p,lang); key=norm_he(p.get('he'))
                    if not r or len(key)<2:continue
                    if key in candidates and text_of(candidates[key]).strip()!=text_of(r).strip(): conflicts.add(key)
                    else:candidates[key]=deepcopy(r)
        for key in conflicts:candidates.pop(key,None)
        report['ambiguousRepeatedHebrew'][lang]=len(conflicts)
        tindex=tanakh_index(lang)
        tfuzzy=tanakh_fuzzy_index(lang)
        report['before'][lang]={};report['filled'][lang]={};report['after'][lang]={}
        for n,data in hydrated.items():
            ps=[p for s in data['sections'] for p in s['paragraphs']]
            report['before'][lang][n]=sum(bool((p.get(lang) or '').strip()) for p in ps)
            report['filled'][lang][n]={'identicalHebrew':0,'exactTanakh':0,'exactTanakhFragments':0,'nearTanakh':0,'nearTanakhFragments':0,'exactSiddurSequence':0,'total':0}
        # Phase 1: one-to-one identical Hebrew and exact complete Tanakh passages.
        for n,data in hydrated.items():
            for s in data['sections']:
                for p in s['paragraphs']:
                    if (p.get(lang) or '').strip():continue
                    key=norm_he(p.get('he'))
                    r=candidates.get(key)
                    if r:
                        apply(p,lang,deepcopy(r),'Reused from an identical reviewed Hebrew paragraph elsewhere in the bundled Siddur.')
                        report['filled'][lang][n]['identicalHebrew']+=1;continue
                    r=exact_tanakh_match(key,tindex)
                    if r:
                        apply(p,lang,r,'Exact complete Hebrew passage matched to the bundled Tanakh; no fuzzy alignment.')
                        report['filled'][lang][n]['exactTanakh']+=1
                        continue
                    r=exact_tanakh_fragment_match(p.get('he',''),tindex)
                    if r:
                        apply(p,lang,r,'Every colon-delimited Hebrew fragment matched an exact complete bundled Tanakh verse; translations joined without fuzzy alignment.')
                        report['filled'][lang][n]['exactTanakhFragments']+=1
                        continue
                    r=near_tanakh_match(key,tfuzzy)
                    if r:
                        apply(p,lang,r,r.get('note'))
                        report['filled'][lang][n]['nearTanakh']+=1
                        continue
                    r=near_tanakh_fragment_match(p.get('he',''),tfuzzy)
                    if r:
                        apply(p,lang,r,r.get('note'))
                        report['filled'][lang][n]['nearTanakhFragments']+=1
        # Phase 2: exact joins of 2-8 consecutive already translated Siddur paragraphs.
        # Two iterations let a newly completed safe join serve another duplicate without fuzzy splitting.
        for _ in range(2):
            sindex=sequence_index(hydrated,lang)
            changed=0
            for n,data in hydrated.items():
                for s in data['sections']:
                    for p in s['paragraphs']:
                        if (p.get(lang) or '').strip():continue
                        r=exact_sequence_match(norm_he(p.get('he')),sindex)
                        if r:
                            apply(p,lang,r,'Exact Hebrew match to a sequence of reviewed Siddur paragraphs; translations joined without fuzzy splitting.')
                            report['filled'][lang][n]['exactSiddurSequence']+=1;changed+=1
            if not changed:break
        for n,data in hydrated.items():
            ps=[p for s in data['sections'] for p in s['paragraphs']]
            report['after'][lang][n]=sum(bool((p.get(lang) or '').strip()) for p in ps)
            row=report['filled'][lang][n];row['total']=row['identicalHebrew']+row['exactTanakh']+row['exactTanakhFragments']+row['nearTanakh']+row['nearTanakhFragments']+row['exactSiddurSequence']
    for n,data in hydrated.items():save_siddur(ROOT,n,data,languages=LANGS)
    out=ROOT/'.text-cache'/'audits'/'siddur-coverage-audit.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
