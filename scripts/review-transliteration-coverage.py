#!/usr/bin/env python3
"""Conservative corpus review for Siddur reading/transliteration aids.

Adds only context-specific pointing repairs proven by an *identical complete
Hebrew passage* elsewhere in the bundled Siddur/Tanakh.  It never changes the
source Hebrew and never guesses vowels from an isolated spelling.
"""
from __future__ import annotations
from collections import Counter, defaultdict
import json,re,unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WORD=re.compile(r"[א-ת\u05F2\uFB1D-\uFB4F][א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05F2\uFB1D-\uFB4F]*(?:['\"׳״][א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*)*",re.UNICODE)
VOWEL=re.compile('[\u05B0-\u05BB\u05C7]|וּ')


def correction_key(word):
    word=unicodedata.normalize('NFKD',word)
    word=re.sub('[\u0591-\u05AF\u05BD\u05BF\u05C4\u05C5]','',word).replace('\u05BA','\u05B9')
    return word

def bare(word):return ''.join(c for c in word if '\u05d0'<=c<='\u05ea')
def name_abbrev(word):return bare(word) in ('יי','ה') and any(q in word for q in "'׳") or bare(word) in ('יי','ײ')

def restore(word,target):
    original=unicodedata.normalize('NFKD',word)
    if not target:return original
    clusters=re.findall(r'[א-ת][^א-ת]*',target); existing=re.findall(r'[א-ת][^א-ת]*',original)
    if len(clusters)!=len(existing) or any(a[0]!=b[0] for a,b in zip(clusters,existing)):return original
    out=[]
    for cluster,required in zip(existing,clusters):
        supplied=correction_key(cluster)
        additions=[m for m in required if ('\u05B0'<=m<='\u05BB' or m in '\u05C1\u05C2\u05C7') and m not in supplied]
        out.append(cluster+''.join(additions))
    return unicodedata.normalize('NFKD',''.join(out))

def unpointed(word):
    if name_abbrev(word) or 'יהוה' in bare(word):return False
    if not VOWEL.search(word):return True
    for cluster in re.findall(r'ש[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*',word):
        if '\u05C1' not in cluster and '\u05C2' not in cluster:return True
    clusters=re.findall(r'[א-ת][\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*',word)
    for i,cluster in enumerate(clusters[:-1]):
        if VOWEL.search(cluster) or cluster[0] in 'אוי':continue
        nxt=clusters[i+1]
        if nxt[0]=='ו' and re.search('[\u05B9\u05BA\u05BC]',nxt):continue
        return True
    return False

def paragraph_context(tokens,i):
    def b(j):return bare(tokens[j]) if 0<=j<len(tokens) else ''
    return '|'.join(b(i+n) for n in (-2,-1,0,1,2))

def load_evidence():
    rows=[]
    for nusach in ('ashkenaz','edot'):
        data=json.loads((ROOT/'public/texts'/f'{nusach}.json').read_text(encoding='utf8'))
        for sec in data['sections']:
            for i,p in enumerate(sec['paragraphs'],1):
                if p.get('kind')=='instruction':continue
                tokens=WORD.findall(p.get('he',''))
                if tokens:rows.append((f'{nusach}:{sec["id"]}:{i}',tokens,True))
    for path in ROOT.joinpath('public/texts').glob('*.json'):
        if path.name in ('catalog.json','ashkenaz.json','edot.json'):continue
        data=json.loads(path.read_text(encoding='utf8'))
        if 'text' not in data:continue
        for ci,ch in enumerate(data['text'],1):
            for vi,p in enumerate(ch,1):
                tokens=WORD.findall(p.get('he',''))
                if tokens:rows.append((f'{path.stem} {ci}:{vi}',tokens,False))
    return rows

def main():
    corr_path=ROOT/'scripts/reading-corrections.json'; data=json.loads(corr_path.read_text(encoding='utf8'))
    words={r['word']:r['to'] for r in data['words']}; contexts={r['word']+'|'+r['context']:r['to'] for r in data['contexts']}
    rows=load_evidence(); groups=defaultdict(list)
    for ref,tokens,is_siddur in rows:
        groups['|'.join(map(bare,tokens))].append((ref,tokens,is_siddur))
    additions=[]
    # Exact whole-passage twins make context-specific repairs safe.
    for group in groups.values():
        if len(group)<2:continue
        length=len(group[0][1])
        if any(len(tokens)!=length for _,tokens,_ in group):continue
        for pos in range(length):
            fully=[]
            for ref,tokens,_ in group:
                w=correction_key(tokens[pos])
                if not unpointed(w):fully.append((w,ref))
            targets={w for w,_ in fully}
            if len(targets)!=1:continue
            target=next(iter(targets)); evidence=[r for w,r in fully if w==target][:3]
            for ref,tokens,is_siddur in group:
                if not is_siddur:continue
                original=correction_key(tokens[pos]); ctx=paragraph_context(tokens,pos); ck=original+'|'+ctx
                current=restore(original,contexts.get(ck) or words.get(original))
                if not unpointed(current) or bare(original)!=bare(target):continue
                repaired=restore(original,target)
                if unpointed(repaired):continue
                if ck in contexts:continue
                contexts[ck]=target
                additions.append({'word':original,'to':target,'context':ctx,'evidence':', '.join(evidence+[ref])})
    # Keep stable order: old reviewed evidence first, newly corpus-proven entries after it.
    if additions:
        data['contexts'].extend(additions)
        corr_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    # Re-audit Siddur prayer tokens with all corrections applied.
    words={r['word']:r['to'] for r in data['words']}; contexts={r['word']+'|'+r['context']:r['to'] for r in data['contexts']}
    per_file=defaultdict(lambda:Counter(paragraphs=0,tokens=0,unresolvedTokens=0,paragraphsWithUnresolved=0))
    examples=[]
    for ref,tokens,is_siddur in rows:
        if not is_siddur:continue
        file=ref.split(':',1)[0]; st=per_file[file];st['paragraphs']+=1; st['tokens']+=len(tokens); bad=[]
        for i,w in enumerate(tokens):
            original=correction_key(w); ctx=paragraph_context(tokens,i)
            repaired=restore(original,contexts.get(original+'|'+ctx) or words.get(original))
            if unpointed(repaired):bad.append(w)
        if bad:
            st['paragraphsWithUnresolved']+=1;st['unresolvedTokens']+=len(bad)
            if len(examples)<80:examples.append({'ref':ref,'words':list(dict.fromkeys(bad))[:12]})
    report={'schema':1,'newExactContextCorrections':len(additions),'wordCorrections':len(data['words']),'contextCorrections':len(data['contexts']),'siddurPrayerAudit':{k:dict(v) for k,v in per_file.items()},'unresolvedExamples':examples}
    (ROOT/'scripts/translations/transliteration-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:v for k,v in report.items() if k!='unresolvedExamples'},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
