#!/usr/bin/env python3
"""Build the reviewed Turkonjak Tanakh subset from project-owner sources.

The supplied TUB SQLite module is the 1997–2007 Ukrainian Bible Society
Turkonjak translation based on the LXX. Straightforward books are imported
only when their chapter/verse shape exactly matches Kavvanah's Hebrew-canon
display. Reviewed per-book mappings cover the places where the TUB module uses
LXX/Orthodox numbering, combines Hebrew verses, or carries Greek additions.
Anything not explicitly verified remains on the configured Ohiienko fallback
rather than being guessed into place.
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
BOOKCODE={
    'genesis':'GEN','numbers':'NUM','deuteronomy':'DEU','joshua':'JOS','i-samuel':'1SA',
    'ii-kings':'2KI','ii-chronicles':'2CH','nehemiah':'NEH','esther':'EST','job':'JOB',
    'psalms':'PSA','proverbs':'PRO','song-of-songs':'SNG','isaiah':'ISA','jeremiah':'JER',
    'ezekiel':'EZK','daniel':'DAN','hosea':'HOS',
}
# TUB's Judges content is sequential but its SQLite chapter labels skip 4 and 12.
JUDGES_TARGET_TO_TUB={1:1,2:2,3:3,**{target:target+1 for target in range(4,11)},**{target:target+2 for target in range(11,22)}}

def sha(path:Path): return hashlib.sha256(path.read_bytes()).hexdigest()
def clean(text:str|None): return re.sub(r'<[^>]+>','',text or '').strip()

def split_once(text:str,marker:str):
    """Split a reviewed combined TUB verse at an exact phrase.

    The source archive is hash-pinned, so an absent marker means the reviewed
    source changed and the import should stop rather than silently guess.
    """
    pos=text.find(marker)
    if pos<0: raise ValueError(f'Reviewed Turkonjak split marker not found: {marker!r}')
    return text[:pos].strip(),text[pos:].strip()

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
    """Load reviewed SIL Russian Orthodox -> Original/BHS mappings.

    Only books confirmed to use these source coordinates in the supplied TUB
    module are admitted here. Most TUB books actually use Hebrew-style verse
    coordinates despite the LXX base text, so applying RSO globally would
    silently shift otherwise-correct verses.
    """
    result=defaultdict(list)
    for line in (ROOT/'scripts/versification/rso.vrs').read_text().splitlines():
        if '=' not in line or line.startswith('#') or line[:3] not in {'GEN','PSA','SNG'}: continue
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

    # Genesis keeps the Orthodox 31/32 chapter boundary but also folds two
    # short Hebrew verses into the preceding TUB verse.
    result['GEN',33,6]=[('GEN',33,6),('GEN',33,7)]
    result['GEN',33,19]=[('GEN',33,19),('GEN',33,20)]

    # Deuteronomy's TUB numbering is Hebrew-style except that the four short
    # commandments are separate source verses. Three other Hebrew verses are
    # folded into the preceding TUB verse.
    result['DEU',2,13]=[('DEU',2,13),('DEU',2,14)]
    result['DEU',3,16]=[('DEU',3,16),('DEU',3,17)]
    result['DEU',14,18]=[('DEU',14,18),('DEU',14,19)]
    for v in range(17,21): result['DEU',5,v]=[('DEU',5,17)]
    for v in range(21,34): result['DEU',5,v]=[('DEU',5,v-3)]

    # The following books use Hebrew-style coordinates in TUB. These are only
    # local content joins/splits verified against the supplied corpus.
    result['2KI',18,20]=[('2KI',18,20),('2KI',18,21)]
    result['JOB',21,30]=[('JOB',21,30),('JOB',21,31)]
    result['JOB',40,4]=[('JOB',40,4),('JOB',40,5)]
    result['ISA',8,23]=[('ISA',8,23)]
    result['ISA',8,24]=[('ISA',8,23)]
    result['ISA',21,10]=[('ISA',21,10),('ISA',21,11)]
    result['ISA',26,7]=[('ISA',26,7),('ISA',26,8)]
    result['ISA',45,23]=[('ISA',45,23),('ISA',45,24)]
    result['ISA',45,24]=[('ISA',45,25)]
    result['ISA',63,19]=[('ISA',63,19)]
    result['ISA',63,20]=[('ISA',63,19)]
    result['HOS',5,15]=[('HOS',5,15)]
    result['HOS',5,16]=[('HOS',5,15)]
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

def reviewed_plan(bid,code,by):
    """Return explicit per-book source->display decisions for reviewed TUB books.

    `mapping` only contains places that differ from identity.  An empty target
    list explicitly discards a Greek addition or duplicate source line.
    `fallback_targets` are canonical display verses intentionally kept on the
    Ohiienko fallback because the LXX-based TUB corpus omits/reworks them.
    `overrides` are reviewed split/combined verse records.
    """
    mapping={}; fallback_targets=set(); skip_chapters=set(); overrides={}
    def origin(ch,v): return (code,ch,v)
    def target(ch,v): return (code,ch,v)
    def mapv(sch,sv,tch,tv): mapping[origin(sch,sv)]=[target(tch,tv)]
    def skip(sch,sv): mapping[origin(sch,sv)]=[]
    def map_range(sch,s0,s1,tch,t0):
        for off,sv in enumerate(range(s0,s1+1)): mapv(sch,sv,tch,t0+off)
    def skip_range(ch,v0,v1):
        for v in range(v0,v1+1): skip(ch,v)
    def fallback(ch,*verses): fallback_targets.update((ch,v) for v in verses)
    def fallback_range(ch,v0,v1): fallback_targets.update((ch,v) for v in range(v0,v1+1))
    def rec(text,ref,note=None):
        value={'text':text,'ref':ref}
        if note: value['note']=note
        return value

    if bid=='numbers':
        # The two census chapters preserve all canonical material but order the
        # tribal blocks differently in the supplied LXX module.
        map_range(1,24,35,1,26)
        map_range(1,36,37,1,24)
        a,b=split_once(by[3][39],'І промовив Господь до Мойсея')
        overrides[3,39]=rec(a,'TUB NUM 3:39 [Levite census clause]','split')
        overrides[3,40]=rec(b,'TUB NUM 3:39 [firstborn command clause]','split')
        first,last=split_once(by[6][23],'і покладуть моє імя')
        overrides[6,23]=rec(first,'TUB NUM 6:23 [first clause]','split')
        overrides[6,27]=rec(last,'TUB NUM 6:23 [final clause]','split')
        mapv(10,34,10,35); mapv(10,35,10,36); mapv(10,36,10,34)
        fallback_range(17,16,28)
        map_range(26,15,18,26,19)
        a,b=split_once(by[26][19],'Ясув рід Ясува')
        overrides[26,23]=rec(a,'TUB NUM 26:19 [Tola/Puvah families]','split')
        overrides[26,24]=rec(b,'TUB NUM 26:19 [Jashub/Shimron families]','split')
        mapv(26,21,26,25)
        map_range(26,22,23,26,26)
        map_range(26,24,27,26,15)
        map_range(26,28,31,26,44)
        map_range(26,32,38,26,28)
        map_range(26,39,41,26,35)
        map_range(26,42,45,26,38)
        map_range(26,46,47,26,42)

    elif bid=='joshua':
        fallback(8,12,13,26)
        map_range(9,3,8,8,30)
        map_range(9,9,33,9,3)
        fallback(10,15,43)
        fallback(13,33)
        first,last=split_once(by[18][26],'Рекем і Єрфаїл')
        overrides[18,26]=rec(first,'TUB JOS 18:26 [first town group]','split')
        overrides[18,27]=rec(last,'TUB JOS 18:26 [second town group]','split')
        mapv(18,27,18,28)
        fallback_range(20,4,6)
        map_range(20,4,6,20,7)
        mapv(24,29,24,31); mapv(24,30,24,29); mapv(24,31,24,30)
        skip(24,34); skip(24,35)

    elif bid=='i-samuel':
        map_range(17,12,20,17,32)
        map_range(17,22,29,17,42)
        map_range(17,30,33,17,51)
        fallback_range(17,12,31); fallback(17,41,50); fallback_range(17,55,58)
        map_range(18,1,4,18,6)
        map_range(18,5,9,18,12)
        map_range(18,10,19,18,20)
        fallback_range(18,1,5); fallback(18,10,11); fallback_range(18,17,19); fallback(18,30)

    elif bid=='ii-chronicles':
        a,b=split_once(by[15][18],'І з ним не було війни')
        overrides[15,18]=rec(a,'TUB 2CH 15:18 [first sentence]','split')
        overrides[15,19]=rec(b,'TUB 2CH 15:18 [final sentence]','split')
        a,b=split_once(by[22][11],'І він був з нею схований')
        overrides[22,11]=rec(a,'TUB 2CH 22:11 [rescue clause]','split')
        overrides[22,12]=rec(b,'TUB 2CH 22:11 [concealment clause]','split')
        mapv(27,8,27,9); fallback(27,8)
        prefix,_=split_once(by[35][19],'І цар Йосія спалив')
        overrides[35,19]=rec(prefix,'TUB 2CH 35:19 [canonical clause]','split')
        skip_range(36,6,9); map_range(36,10,27,36,6)
        text=by[36][27]
        suffix='Молитва Манассії.'
        if not text.endswith(suffix): raise ValueError('Unexpected 2 Chronicles 36:27 Turkonjak suffix')
        overrides[36,23]=rec(text[:-len(suffix)].strip(),'TUB 2CH 36:27 [canonical clause only]','split')

    elif bid=='nehemiah':
        a,b=split_once(by[3][6],'І при їхній руці скріплював')
        overrides[3,6]=rec(a,'TUB NEH 3:6 [Old Gate clause]','split')
        overrides[3,7]=rec(b,'TUB NEH 3:6 [next builders]','split')
        a,b=split_once(by[3][14],'А браму джерела')
        overrides[3,14]=rec(a,'TUB NEH 3:14 [Dung Gate clause]','split')
        overrides[3,15]=rec(' '.join((b,by[3][15])).strip(),'TUB NEH 3:14, TUB NEH 3:15','combined')
        fallback(3,38)
        skip(7,68); map_range(7,69,73,7,68)
        fallback(11,16,20,21); fallback_range(11,25,35)
        skip_range(11,25,31); mapv(11,32,11,36)

    elif bid=='proverbs':
        # These four LXX chapters substantially omit/reorder Masoretic verses;
        # keep their canonical display on the existing reviewed fallback.
        skip_chapters.update({16,18,19,20})
        for ch in skip_chapters: fallback_range(ch,1,max(by[ch]))
        # Proverbs 31:25-26 are transposed in the supplied TUB module.
        mapv(31,25,31,26); mapv(31,26,31,25)

    elif bid=='ezekiel':
        # Chapter 7 is internally reordered in the LXX text; chapter 32 has a
        # different omitted/split sequence.  Keep those two chapters canonical
        # until a phrase-level mapping is separately reviewed.
        skip_chapters.update({7,32})
        fallback_range(7,1,27); fallback_range(32,1,32)
        fallback(1,14)
        overrides[1,28]=rec(' '.join((by[1][28],by[1][29])).strip(),'TUB EZK 1:28, TUB EZK 1:29','combined')

    elif bid=='esther':
        skip_range(1,1,17); map_range(1,18,39,1,1)
        prefix,_=split_once(by[3][13],'А зміст листа такий:')
        overrides[3,13]=rec(prefix,'TUB EST 3:13 [canonical clause]','split')
        skip_range(3,14,19); mapv(3,20,3,14); mapv(3,21,3,15)
        fallback(4,6)
        # Greek prayers and the expanded royal audience follow canonical 4:17.
        skip_range(4,18,45)
        map_range(5,1,12,5,3); fallback(5,1,2)
        skip(8,9); fallback(8,9); skip_range(8,13,36)
        map_range(8,37,41,8,13)
        # TUB 9:5 is the Susa 500-dead verse (canonical 9:6); canonical 9:5
        # itself is omitted and 9:6 is an empty placeholder in the module.
        mapv(9,5,9,6); skip(9,6); fallback(9,5)
        prefix,_=split_once(by[10][3],'І Мардохей сказав:')
        overrides[10,3]=rec(prefix,'TUB EST 10:3 [canonical clause]','split')
        skip_range(10,4,11)

    elif bid=='daniel':
        # Prayer/Song of the Three (3:24-90), Susanna (13), and Bel (14) are
        # retained in the LXX source but are outside Kavvanah's 12-chapter
        # Tanakh display. Canonical 3:24-33 continues at TUB 3:91-97 + 4:1-3.
        skip_range(3,24,90)
        map_range(3,91,97,3,24)
        map_range(4,1,3,3,31)
        map_range(4,4,37,4,1)

    elif bid=='jeremiah':
        # 2:1 is absent; TUB 2:7 folds canonical 2:8-9 into one source line.
        fallback(2,1); map_range(2,1,6,2,2)
        a,b=split_once(by[2][7],'Через це ще судитимуся')
        overrides[2,8]=rec(a,'TUB JER 2:7 [first clause]','split')
        overrides[2,9]=rec(b,'TUB JER 2:7 [final clause]','split')
        map_range(2,8,35,2,10)
        # Chapter 7 omits the superscription and canonical 7:27.
        fallback(7,1,27); map_range(7,1,25,7,2); map_range(7,26,32,7,28)
        # LXX TUB begins this chapter at canonical 17:5.
        fallback_range(17,1,4); map_range(17,1,23,17,5)
        # Canonical 23:7-8 are duplicated at the end of the TUB chapter; 23:27
        # itself is absent.
        skip(23,7); skip(23,8); skip(23,27); fallback(23,27)
        mapv(23,41,23,7); mapv(23,42,23,8)
        # Five Masoretic verses are absent in the shorter LXX form.
        fallback(27,1,7,13,17,20)
        map_range(27,1,6,27,2); map_range(27,7,10,27,8)
        map_range(27,11,13,27,14); map_range(27,14,15,27,18); map_range(27,16,17,27,21)
        # The supplied LXX text ends this chapter after canonical 33:13.
        fallback_range(33,14,26)
        # TUB 39:4-8 contain canonical 39:14-18; the capture/exile block is
        # absent from this chapter in the source.
        fallback_range(39,4,13); map_range(39,4,8,39,14)
        fallback_range(48,45,47)
        fallback(49,6); map_range(49,6,38,49,7)
        # 31:35-37 are present but appear in a 37,35,36 order.
        mapv(31,35,31,37); mapv(31,36,31,35); mapv(31,37,31,36)

    return mapping,fallback_targets,skip_chapters,overrides

def mapped_book(base,by,oh,bid,code,mapping,*,fallback_targets=None,skip_chapters=None,overrides=None):
    fallback_targets=fallback_targets or set(); skip_chapters=skip_chapters or set(); overrides=overrides or {}
    assigned=defaultdict(dict); source_targets=defaultdict(set)
    for ch,verses in by.items():
        for v,text in verses.items():
            if not text: continue
            if ch in skip_chapters: continue
            origin=(code,ch,v)
            for dc,tc,tv in mapping.get(origin,[origin]):
                if dc!=code or tc<1 or tc>len(base['text']) or tv<1 or tv>len(base['text'][tc-1]): continue
                assigned[tc,tv][origin]=text; source_targets[origin].add((tc,tv))
    chapters=[]; blanks=0
    for ch,chapter in enumerate(base['text'],1):
        out=[]
        for v in range(1,len(chapter)+1):
            if (ch,v) in overrides:
                out.append(overrides[ch,v]); continue
            if (ch,v) in fallback_targets:
                out.append(fallback_record(oh,bid,ch,v,f'No reviewed TUB equivalent for {code} {ch}:{v}; Ohiienko fallback')); blanks+=1; continue
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
            if chapters is None and bid in BOOKCODE:
                code=BOOKCODE[bid]
                extra,fallback_targets,skip_chapters,overrides=reviewed_plan(bid,code,by)
                book_mapping=dict(mapping); book_mapping.update(extra)
                chapters,book_blanks=mapped_book(
                    base,by,oh,bid,code,book_mapping,
                    fallback_targets=fallback_targets,skip_chapters=skip_chapters,overrides=overrides,
                )
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
