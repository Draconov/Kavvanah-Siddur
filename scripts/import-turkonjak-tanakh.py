#!/usr/bin/env python3
"""Build the reviewed Turkonjak Tanakh subset from project-owner sources.

The supplied TUB SQLite module is the 1997–2007 Ukrainian Bible Society
Turkonjak translation based on the LXX. Straightforward books are imported
only when their chapter/verse shape exactly matches Kavvanah's Hebrew-canon
display. Reviewed LXX/Orthodox-versification mappings are additionally used
for Judges, Psalms and Song of Songs. Anything not explicitly verified remains
on the configured Ohiienko fallback rather than being guessed into place.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sqlite3, tempfile, zipfile
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/texts/translations/tanakh/uk-turkonjak-utt.json'
TUB_ZIP_SHA256='8d06571f18f118093bf1c73bb85f1ccd4723d99bc2261b162fc8984d7e4a9920'
XAPK_SHA256='a7785ae36da1498ca76de2c37188cff6e4ef2b570e3c50f750ed561db4689217'
XAPK_APK='by.uniq.ukrainska_biblia_turkoniak_2011.apk'
YES_ASSET='assets/internal/default_book/uk-utt--1.yes'
YES_MAGIC=bytes.fromhex('98580d0a005de003')
BOOKNUM={'genesis':10,'exodus':20,'leviticus':30,'numbers':40,'deuteronomy':50,'joshua':60,'judges':70,'ruth':80,'i-samuel':90,'ii-samuel':100,'i-kings':110,'ii-kings':120,'i-chronicles':130,'ii-chronicles':140,'ezra':150,'nehemiah':160,'esther':190,'job':220,'psalms':230,'proverbs':240,'ecclesiastes':250,'song-of-songs':260,'isaiah':290,'jeremiah':300,'lamentations':310,'ezekiel':330,'daniel':340,'hosea':350,'joel':360,'amos':370,'obadiah':380,'jonah':390,'micah':400,'nahum':410,'habakkuk':420,'zephaniah':430,'haggai':440,'zechariah':450,'malachi':460}
BOOKCODE={'psalms':'PSA','song-of-songs':'SNG'}
# TUB's Judges content is sequential but its SQLite chapter labels skip 4 and 12.
JUDGES_TARGET_TO_TUB={1:1,2:2,3:3,**{target:target+1 for target in range(4,11)},**{target:target+2 for target in range(11,22)}}

def sha(path:Path): return hashlib.sha256(path.read_bytes()).hexdigest()
def clean(text:str|None): return re.sub(r'<[^>]+>','',text or '').strip()

def verify_xapk(path:Path):
    if sha(path)!=XAPK_SHA256: raise ValueError('Unreviewed Turkonjak XAPK revision')
    with zipfile.ZipFile(path) as x: apk=x.read(XAPK_APK)
    with tempfile.NamedTemporaryFile(suffix='.apk') as f:
        f.write(apk); f.flush()
        with zipfile.ZipFile(f.name) as z:
            yes=z.read(YES_ASSET); manifest=json.loads(z.read('assets/internal/default_book/manifest.json'))
    if yes[:8]!=YES_MAGIC: raise ValueError('Unexpected YES3 header')
    if manifest.get('presetName')!='uk-utt': raise ValueError('Unexpected Turkonjak preset')
    return len(yes)

def refs(value:str):
    code,chapter,first,last=re.fullmatch(r'(\w{3}) (\d+):(\d+)(?:-(\d+))?',value).groups()
    return [(code,int(chapter),v) for v in range(int(first),int(last or first)+1) if v>0]

def rso_mappings():
    """Load the checked-in SIL Russian Orthodox -> Original/BHS mappings."""
    result=defaultdict(list)
    for line in (ROOT/'scripts/versification/rso.vrs').read_text().splitlines():
        if '=' not in line or line.startswith('#') or line[:3] not in {'PSA','SNG'}: continue
        left,right=line.split('=',1); source,target=refs(left.strip()),refs(right.strip())
        if not source or not target: continue
        if left.strip()=='PSA 89:2-6':
            # The source separates the heading and combines Hebrew 90:5-6.
            for v in range(2,7): result['PSA',89,v].append(('PSA',90,v-1))
            result['PSA',89,6].append(('PSA',90,6))
            continue
        if len(source)!=len(target): raise ValueError(f'Unresolved RSO verse range: {line}')
        for a,b in zip(source,target): result[a].append(b)
    # The Synodal module has an empty 114:9 placeholder, but TUB has the verse
    # as a real separate line; keep both Hebrew Psalm 116 verses distinct.
    result['PSA',114,8]=[('PSA',116,8)]
    result['PSA',114,9]=[('PSA',116,9)]
    # TUB numbers the Psalm 142 superscription as LXX 141:1, not verse zero.
    for v in range(1,9): result['PSA',141,v]=[('PSA',142,v)]
    return result

def fallback_record(oh,bid,ch,v,ref):
    rec=oh['books'][bid]['chapters'][ch-1][v-1]
    return {'text':rec['text'] if isinstance(rec,dict) else rec,'ref':ref,'edition':'uk-ohienko-1962'}

def exact_book(base,by,oh,bid):
    source_shape=[max(by.get(ch,{}) or {0:None}) for ch in range(1,len(base['text'])+1)]
    target_shape=[len(ch) for ch in base['text']]
    if source_shape!=target_shape: return None,0
    chapters=[]; blanks=0
    for ch_i,chapter in enumerate(base['text'],1):
        out=[]
        for v_i in range(1,len(chapter)+1):
            text=by.get(ch_i,{}).get(v_i,'')
            if text: out.append({'text':text,'ref':f'TUB {ch_i}:{v_i}'})
            else:
                out.append(fallback_record(oh,bid,ch_i,v_i,f'TUB {ch_i}:{v_i} [empty]; Ohiienko fallback')); blanks+=1
        chapters.append(out)
    return chapters,blanks

def judges_book(base,by,oh):
    chapters=[]; blanks=0
    for target_ch,chapter in enumerate(base['text'],1):
        source_ch=JUDGES_TARGET_TO_TUB[target_ch]
        source=by.get(source_ch,{})
        if sorted(source)!=list(range(1,len(chapter)+1)):
            raise ValueError(f'Unexpected TUB Judges shape at source chapter {source_ch}')
        out=[]
        for v in range(1,len(chapter)+1):
            text=source.get(v,'')
            ref=f'TUB {source_ch}:{v} → JDG {target_ch}:{v}' if source_ch!=target_ch else f'TUB {source_ch}:{v}'
            if text: out.append({'text':text,'ref':ref})
            else: out.append(fallback_record(oh,'judges',target_ch,v,ref+' [empty]; Ohiienko fallback')); blanks+=1
        chapters.append(out)
    return chapters,blanks

def mapped_book(base,by,oh,bid,code,mapping):
    assigned=defaultdict(dict); source_targets=defaultdict(set)
    for ch,verses in by.items():
        for v,text in verses.items():
            if not text: continue
            origin=(code,ch,v)
            for dc,tc,tv in mapping.get(origin,[origin]):
                if dc!=code or tc<1 or tc>len(base['text']) or tv<1 or tv>len(base['text'][tc-1]): continue
                assigned[tc,tv][origin]=text; source_targets[origin].add((tc,tv))
    chapters=[]; blanks=0
    for ch,chapter in enumerate(base['text'],1):
        out=[]
        for v in range(1,len(chapter)+1):
            entries=assigned.get((ch,v),{})
            if entries:
                record={'text':' '.join(entries.values()),'ref':', '.join(f'TUB {c} {n}:{sv}' for c,n,sv in entries)}
                if len(entries)>1 or any(len(source_targets[origin])>1 for origin in entries): record['note']='combined'
                out.append(record)
            else:
                out.append(fallback_record(oh,bid,ch,v,f'No reviewed TUB mapping for {code} {ch}:{v}; Ohiienko fallback')); blanks+=1
        chapters.append(out)
    return chapters,blanks

def build(tub_zip:Path):
    if sha(tub_zip)!=TUB_ZIP_SHA256: raise ValueError('Unreviewed TUB source revision')
    with zipfile.ZipFile(tub_zip) as z: db_bytes=z.read('TUB.SQLite3')
    with tempfile.NamedTemporaryFile(suffix='.sqlite3') as f:
        f.write(db_bytes); f.flush(); con=sqlite3.connect(f.name)
        info=dict(con.execute('select name,value from info'))
        if info.get('language')!='uk' or 'Рафаїла Турконяка' not in info.get('description',''): raise ValueError('Unexpected TUB metadata')
        oh=json.loads((ROOT/'public/texts/translations/tanakh/uk-ohienko-1962.json').read_text())
        mapping=rso_mappings(); books={}; available=[]; total=0; blanks=0
        for bid,bn in BOOKNUM.items():
            base=json.loads((ROOT/'public/texts'/f'{bid}.json').read_text())
            rows=con.execute('select chapter,verse,text from verses where book_number=? order by chapter,verse',(bn,)).fetchall()
            by=defaultdict(dict)
            for ch,v,text in rows: by[ch][v]=clean(text)
            chapters,book_blanks=exact_book(base,by,oh,bid)
            if chapters is None and bid=='judges': chapters,book_blanks=judges_book(base,by,oh)
            if chapters is None and bid in BOOKCODE: chapters,book_blanks=mapped_book(base,by,oh,bid,BOOKCODE[bid],mapping)
            if chapters is None: continue
            books[bid]={'chapters':chapters}; available.append(bid); blanks+=book_blanks; total+=sum(map(len,chapters))
    bundle={'schema':1,'language':'uk','edition':'uk-turkonjak-utt','sources':[
      {'title':'Біблія · Рафаїл Турконяк','version':'Новий переклад УБТ Рафаїла Турконяка (1997–2007), LXX-based','language':'uk','license':'User-supplied source archive; source metadata states © 1997–2007 Рафаїл Турконяк, Українське Біблійне Товариство','url':'user-supplied 4205_TUB.zip / Turkonjak XAPK'},
      {'title':'Tanakh · Ukrainian · Ohiienko','version':'Огієнко 1962 (fallback only where a reviewed Turkonjak mapping has no displayed Hebrew equivalent)','language':'uk','license':'User-supplied source','url':'https://www.bible.com/uk/versions/186'}], 'books':books}
    OUT.write_text(json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+'\n')
    return available,total,blanks

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--tub-zip',type=Path,required=True); ap.add_argument('--xapk',type=Path); args=ap.parse_args()
    if args.xapk: print('Verified embedded YES3 bytes:',verify_xapk(args.xapk))
    books,total,blanks=build(args.tub_zip); print(f'Turkonjak: {len(books)} books / {total} verses ({blanks} Ohiienko fallbacks) -> {OUT.relative_to(ROOT)}')
if __name__=='__main__': main()
