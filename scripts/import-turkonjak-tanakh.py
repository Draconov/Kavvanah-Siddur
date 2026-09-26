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
    'genesis':'GEN','exodus':'EXO','numbers':'NUM','deuteronomy':'DEU','joshua':'JOS','i-samuel':'1SA',
    'i-kings':'1KI','ii-kings':'2KI','ii-chronicles':'2CH','nehemiah':'NEH','esther':'EST','job':'JOB',
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

def reviewed_exact_patches(chapters,by,bid):
    """Trim reviewed joins that otherwise appear as an empty next verse.

    These books already match the target chapter/verse shape, so the generic
    exact importer is correct except for a few TUB lines that contain the text
    of the following canonical verse while that following SQLite row is empty.
    Return the number of fallback rows recovered.
    """
    recovered=0
    def rec(text,ref,note='split'): return {'text':text,'ref':ref,'note':note}

    if bid=='leviticus':
        first,second=split_once(by[19][28],'Не опоганиш твоєї дочки')
        chapters[18][27]=rec(first,'TUB 19:28 [canonical 19:28 clause]')
        chapters[18][28]=rec(second,'TUB 19:28 [canonical 19:29 clause]'); recovered+=1
    elif bid=='ii-samuel':
        first,second=split_once(by[16][1],'І сказав цар до Сіви: Що це тобі?')
        chapters[15][0]=rec(first,'TUB 16:1 [canonical 16:1 clause]')
        chapters[15][1]=rec(second,'TUB 16:1 [canonical 16:2 clause]'); recovered+=1
    elif bid=='i-chronicles':
        first,second=split_once(by[11][8],'І Давид пішов')
        chapters[10][7]=rec(first,'TUB 11:8 [city-building clause]')
        chapters[10][8]=rec(second,'TUB 11:8 [canonical 11:9 clause]'); recovered+=1
    elif bid=='lamentations':
        first,second=split_once(by[4][4],'Ті, що їдять вибагані страви')
        chapters[3][3]=rec(first,'TUB 4:4 [canonical 4:4 clause]')
        chapters[3][4]=rec(second,'TUB 4:4 [canonical 4:5 clause]'); recovered+=1
    return recovered

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

    if bid=='genesis':
        # Two chapter-boundary rows also fold the final Hebrew verse of the
        # preceding chapter into the first TUB verse of the next chapter.
        g225,g31=split_once(by[3][1],'Змій же був')
        overrides[2,25]=rec(g225,'TUB GEN 3:1 [canonical 2:25 clause]','split')
        overrides[3,1]=rec(g31,'TUB GEN 3:1 [canonical 3:1 clause]','split')
        g532,g61=split_once(by[6][1],'І сталося коли')
        overrides[5,32]=rec(g532,'TUB GEN 6:1 [canonical 5:32 clause]','split')
        overrides[6,1]=rec(g61,'TUB GEN 6:1 [canonical 6:1 clause]','split')

        # TUB 31:46 and 31:48 each contain material belonging to two Hebrew
        # display verses.  Split those joins so canonical 31:51 no longer
        # needs a fallback and the neighbouring records do not carry duplicates.
        p46,p48=split_once(by[31][46],'І сказав йому Лаван:')
        overrides[31,46]=rec(p46,'TUB GEN 31:46 [canonical 31:46 clause]','split')
        overrides[31,48]=rec(p48,'TUB GEN 31:46 [canonical 31:48 clause]','split')
        p51,p52=split_once(by[31][48],'свідчить ця могила')
        overrides[31,51]=rec(p51,'TUB GEN 31:48 [canonical 31:51 clause]','split')
        overrides[31,52]=rec(' '.join((p52,by[31][52])).strip(),'TUB GEN 31:48, TUB GEN 31:52 [canonical 31:52 clauses]','combined')

    elif bid=='exodus':
        # TUB follows the LXX construction order in Exodus 36-39. Keep only
        # reviewed canonical correspondences and discard source-only ordering
        # material rather than attaching it to same-numbered Hebrew verses.
        skip_range(20,1,max(by[20]))
        map_range(20,1,12,20,1)
        for sv in range(13,17): mapv(20,sv,20,13)
        map_range(20,17,26,20,14)

        for sch in (36,37,38,39): skip_range(sch,1,max(by[sch]))
        map_range(36,1,7,36,1)
        map_range(36,8,38,39,1)
        # LXX courtyard block -> canonical courtyard block.
        map_range(37,7,21,38,9)
        # Metals accounting -> canonical Exodus 38:24-31.
        map_range(39,1,6,38,24)
        mapv(39,7,38,30); mapv(39,9,38,30); mapv(39,8,38,31)
        # Presentation of the finished sanctuary -> canonical 39:32-43.
        mapv(39,10,39,32)
        mapv(39,13,39,33); mapv(39,20,39,34); mapv(39,14,39,35)
        mapv(39,17,39,36); mapv(39,16,39,37); mapv(39,15,39,38)
        mapv(39,19,39,40); mapv(39,21,39,40); mapv(39,18,39,41)
        mapv(39,22,39,42); mapv(39,23,39,43)
        # The LXX moves several *execution* blocks instead of omitting them.
        # Recover only same-event construction text; do not substitute the
        # earlier instruction parallels from Exodus 25-30.
        mapv(37,1,36,8); mapv(37,2,36,9)
        mapv(37,3,36,35); mapv(37,4,36,36); mapv(37,5,36,37); mapv(37,6,36,38)

        # Ark, table, lampstand, and anointing-incense execution material is
        # preserved in TUB/LXX source chapter 38.
        mapv(38,1,37,1); mapv(38,2,37,2); mapv(38,3,37,3)
        mapv(38,5,37,6); mapv(38,6,37,7); mapv(38,7,37,8); mapv(38,8,37,9)
        mapv(38,9,37,10); mapv(38,10,37,13); mapv(38,12,37,16); mapv(38,13,37,17)
        mapv(38,14,37,18); mapv(38,15,37,18); mapv(38,17,37,23); mapv(38,25,37,29)

        # A few bronze-altar / laver details survive later in the same source
        # chapter. Split the exact combined network/rings sentence.
        mapv(38,23,38,3); mapv(38,26,38,8)
        x384,x385=split_once(by[38][24],'І поклав')
        overrides[38,4]=rec(x384,'TUB EXO 38:24 [altar network clause]','split')
        overrides[38,5]=rec(x385,'TUB EXO 38:24 [altar rings clause]','split')

        # Canonical construction detail not preserved verse-for-verse in the
        # supplied LXX module stays on the reviewed Ohiienko fallback.
        fallback_range(36,10,34)
        fallback(37,4,5,11,12,14,15,19,20,21,22,24,25,26,27,28)
        fallback(38,1,2,6,7); fallback(39,39)

        # Chapter 40 repeats setup/washing language preserved elsewhere in the
        # same Turkonjak corpus. Reuse only the exact matching clauses.
        _,x407=split_once(by[30][18],'І поставиш')
        overrides[40,7]=rec(x407,'TUB EXO 30:18 [canonical repeated 40:7 clause]','canonical repetition')
        wash=by[38][27]
        _,wash=split_once(wash,'щоб умивали')
        x4031,x4032=split_once(wash,'коли вони входили')
        overrides[40,31]=rec(x4031,'TUB EXO 38:27 [canonical repeated 40:31 clause]','canonical repetition')
        overrides[40,32]=rec(x4032,'TUB EXO 38:27 [canonical repeated 40:32 clause]','canonical repetition')
        overrides[40,11]=rec(' '.join((by[30][28],by[30][29])).strip(),'TUB EXO 30:28-29 [canonical repeated 40:11 basin/anointing clause]','canonical repetition')

    elif bid=='i-kings':
        # 3 Kingdoms / 1 Kings in the supplied LXX module contains large
        # additions and several block moves. Reset only the affected source
        # chapters, then map verified canonical material explicitly.
        for sch in (2,3,4,5,6,7,9,12,14,20,21,22):
            skip_range(sch,1,max(by[sch]))

        # Chapter 2: canonical 1-35, then a long Greek summary/addition, then
        # canonical Shimei 36-46 at source 50-60.
        map_range(2,1,35,2,1)
        first,_=split_once(by[2][35],'І царство піднялося')
        overrides[2,35]=rec(first,'TUB 1KI 2:35 [canonical clause]','split')
        map_range(2,50,60,2,36)

        # Canonical 3:1 survives at the start of the chapter-2 Greek summary;
        # the actual source chapter 3 then resumes at canonical 3:2.
        k31,_=split_once(by[2][38],'доки він')
        overrides[3,1]=rec(k31,'TUB 1KI 2:38 [canonical 3:1 clause]','split')
        map_range(3,1,27,3,2)

        # Chapter 4 is canonical through v19; v20 survives in the Greek
        # summary at source 2:61.
        map_range(4,1,19,4,1); mapv(2,61,4,20)
        _,last=split_once(by[2][61],'і Юда й Ізраїль')
        overrides[4,20]=rec(last,'TUB 1KI 2:61 [canonical clause]','split')

        # Chapter 5 has four omitted supply verses plus one empty source slot;
        # three omitted verses survive in the chapter-2 Greek summary.
        mapv(2,62,5,1); map_range(5,2,4,5,2); mapv(2,67,5,5); mapv(2,69,5,6)
        _,last=split_once(by[2][67],'і Юда й Ізраїль')
        overrides[5,5]=rec(last,'TUB 1KI 2:67 [canonical clause]','split')
        mapv(5,1,5,7); fallback(5,8); map_range(5,9,30,5,9)
        # The foundation/builders clauses moved to source 6:2-3.
        mapv(6,2,5,31); mapv(6,3,5,32)

        # Temple construction: 6:4-5 preserve the canonical closing dates,
        # and 6:6-14 correspond to canonical 6:2-10.
        mapv(6,1,6,1); map_range(6,6,14,6,2); fallback_range(6,11,14)
        map_range(6,15,36,6,15); mapv(6,4,6,37); mapv(6,5,6,38)

        # Chapter 7 places Hiram's bronze work before Solomon's palace. Restore
        # the Masoretic display order without relabelling source-only material.
        map_range(7,38,49,7,1)
        # Hiram's bronze-work block has several local LXX compressions and
        # reorders. Map the objects themselves rather than assuming sequence.
        map_range(7,1,4,7,13)
        mapv(7,5,7,17); mapv(7,6,7,18); mapv(7,8,7,19); mapv(7,9,7,20); mapv(7,7,7,21)
        fallback(7,22)
        mapv(7,10,7,23); mapv(7,11,7,24); mapv(7,13,7,25); mapv(7,12,7,26)
        map_range(7,14,17,7,27); fallback(7,31); map_range(7,18,31,7,32)
        mapv(7,33,7,46); mapv(7,32,7,47); map_range(7,34,37,7,48)

        # Canonical 8:12-13 survives as the appended Solomon poem in TUB 8:53.
        k853,poem=split_once(by[8][53],'Тоді сказав Соломон про дім')
        _,darkhouse=split_once(poem,'Господь сказав')
        k812,k813rest=split_once(darkhouse,'Збудуй мій дім')
        k813,_=split_once(k813rest,'Чи не ось це')
        overrides[8,53]=rec(k853,'TUB 1KI 8:53 [canonical 8:53 clause]','split')
        overrides[8,12]=rec(k812,'TUB 1KI 8:53 [canonical 8:12 poem clause]','split')
        overrides[8,13]=rec(k813,'TUB 1KI 8:53 [canonical 8:13 poem clause]','split')

        # Chapter 9 omits most of canonical 15-23, but 24-25 are preserved in
        # the chapter-2 Greek summary before the fleet closes the chapter.
        map_range(9,1,14,9,1); fallback_range(9,15,23); mapv(2,41,9,24); mapv(2,42,9,25)
        map_range(9,15,17,9,26)

        # Canonical 12:2 is folded into the end of TUB 11:43.
        k1143,k1202=split_once(by[11][43],'І сталося, що як почув Єровоам')
        overrides[11,43]=rec(k1143,'TUB 1KI 11:43 [canonical 11:43 clause]','split')
        overrides[12,2]=rec(k1202,'TUB 1KI 11:43 [canonical 12:2 clause]','split')

        # Chapter 12 contains a long alternate Greek narrative in 25-47; its
        # canonical ending resumes at source 48.
        map_range(12,1,24,12,1); map_range(12,48,56,12,25)

        # LXX chapter 14 contains only the Rehoboam close, canonical 14:21-31.
        # A few Jeroboam/Ahijah details survive in the alternate narrative at
        # TUB 12:31-37; recover only clauses with direct canonical equivalents.
        fallback_range(14,1,20); map_range(14,1,11,14,21)
        k1401,_=split_once(by[12][31],'І пішов Єровоам')
        overrides[14,1]=rec(k1401,'TUB 1KI 12:31 [canonical 14:1 clause]','split')
        _,k1412=split_once(by[12][35],'Ось ти відійдеш')
        overrides[14,12]=rec(k1412,'TUB 1KI 12:35 [canonical 14:12 clause]','split')
        k1411,k1413=split_once(by[12][36],'І оплакуватимуть дитину')
        overrides[14,11]=rec(k1411,'TUB 1KI 12:36 [canonical 14:11 clause]','split')
        overrides[14,13]=rec(k1413,'TUB 1KI 12:36 [canonical 14:13 clause]','split')
        overrides[14,17]=rec(by[12][37],'TUB 1KI 12:37 [canonical 14:17 event]','canonical parallel')

        # Source 11:1 folds the canonical wife count (11:3) into the middle of
        # canonical 11:1. Rebuild the two display verses without duplication.
        k111,krest=split_once(by[11][1],'І було в нього сімсот жінок')
        k113,k111b=split_once(krest,'І він взяв жінок - чужинок')
        overrides[11,1]=rec(' '.join((k111,k111b)).strip(),'TUB 1KI 11:1 [canonical 11:1 clauses]','split')
        overrides[11,3]=rec(k113,'TUB 1KI 11:1 [canonical 11:3 clause]','split')

        # A few Hebrew verses are canonical repetitions or are joined to the
        # preceding TUB line. Reuse/split only the exact matching source text.
        k1627,k1628=split_once(by[16][27],'І заснув Амврій')
        overrides[16,27]=rec(k1627,'TUB 1KI 16:27 [canonical 16:27 clause]','split')
        overrides[16,28]=rec(k1628,'TUB 1KI 16:27 [canonical 16:28 clause]','split')
        k1327,_=split_once(by[13][13],'і він сів на нього')
        overrides[13,27]=rec(k1327,'TUB 1KI 13:13 [canonical repeated 13:27 clause]','canonical repetition')
        overrides[15,6]=rec(by[14][10],'TUB 1KI 14:10 [canonical repeated 15:6 clause]','canonical repetition')
        overrides[15,32]=rec(by[15][16],'TUB 1KI 15:16 [canonical repeated 15:32 clause]','canonical repetition')
        k1915,k1916=split_once(by[19][15],'І Ія сина Намессія')
        overrides[19,15]=rec(k1915,'TUB 1KI 19:15 [Hazael clause]','split')
        overrides[19,16]=rec(k1916,'TUB 1KI 19:15 [Jehu/Elisha clause]','split')

        # Naboth and Ben-Hadad chapters are swapped in this source.
        map_range(20,1,29,21,1); map_range(21,1,43,20,1)

        # Chapter 22 omits the Edom/ships paragraph block before Jehoshaphat's
        # death; source 47-50 resume at canonical 51-54.
        map_range(22,1,46,22,1); fallback_range(22,47,50); map_range(22,47,50,22,51)

    elif bid=='numbers':
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
        first,last=split_once(by[7][2],'І повернулися до Ісуса')
        overrides[7,2]=rec(first,'TUB JOS 7:2 [reconnaissance clause]','split')
        overrides[7,3]=rec(last,'TUB JOS 7:2 [report clause]','split')
        fallback(8,13,26)
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
        # Hebrew 27:8 repeats the king's age/reign from 27:1; the LXX/TUB
        # omits that duplicate line.  Reuse only the matching clause from
        # TUB 27:1, while source 27:8 remains canonical 27:9.
        repeated,_=split_once(by[27][1],', й імя його матері')
        overrides[27,8]=rec(repeated,'TUB 2CH 27:1 [canonical repeated 27:8 clause]','canonical repetition')
        mapv(27,8,27,9)
        prefix,_=split_once(by[35][19],'І цар Йосія спалив')
        overrides[35,19]=rec(prefix,'TUB 2CH 35:19 [canonical clause]','split')
        skip_range(36,6,9); map_range(36,10,27,36,6)
        text=by[36][27]
        suffix='Молитва Манассії.'
        if not text.endswith(suffix): raise ValueError('Unexpected 2 Chronicles 36:27 Turkonjak suffix')
        overrides[36,23]=rec(text[:-len(suffix)].strip(),'TUB 2CH 36:27 [canonical clause only]','split')

    elif bid=='nehemiah':
        # TUB 2:17 contains both canonical 2:17 and the otherwise-empty 2:18.
        a,b=split_once(by[2][17],'І сповістив я їм')
        overrides[2,17]=rec(a,'TUB NEH 2:17 [canonical 2:17 clause]','split')
        overrides[2,18]=rec(b,'TUB NEH 2:17 [canonical 2:18 clause]','split')
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
        # Proverbs 16 is strongly reordered in the LXX.  The supplied TUB
        # chapter nevertheless preserves most Masoretic sayings after the
        # opening additions/omissions.  Map only the reviewed correspondences.
        skip_range(16,1,max(by[16]))
        mapv(16,5,16,4); mapv(16,2,16,5)
        map_range(16,6,12,16,10)
        first,rest=split_once(by[16][13],'Хто сприймає напоумлення')
        _,rest=split_once(rest,'Хто береже свої дороги')
        guarded,_=split_once(rest,'Хто любить своє життя')
        overrides[16,17]=rec(' '.join((first,guarded)).strip(),'TUB PRO 16:13 [canonical clauses]','split')
        map_range(16,14,29,16,18)

        # Proverbs 18:1-21 are in canonical order.  Source 18:22 carries the
        # canonical wife saying followed by LXX-only/cross-chapter material.
        wife,_=split_once(by[18][22],'Хто викидає добру жінку')
        overrides[18,22]=rec(wife,'TUB PRO 18:22 [canonical clause]','split')

        # TUB Proverbs 19 starts with canonical 19:4; MT 19:1-3 are absent.
        map_range(19,1,26,19,4)

        # Proverbs 20 keeps 1-13, but source 20:9 also carries canonical
        # 20:20-22 and source 20:13 carries canonical 20:23.  Verses 14-19
        # are absent in this LXX form; source 14-20 resume at canonical 24-30.
        skip(20,9)
        p9,rest=split_once(by[20][9],'Хто злословить батька')
        p20,rest=split_once(rest,'Часть раніше поспішно')
        p21,p22=split_once(rest,'Не кажи:')
        overrides[20,9]=rec(p9,'TUB PRO 20:9 [canonical 20:9 clause]','split')
        overrides[20,20]=rec(p20,'TUB PRO 20:9 [canonical 20:20 clause]','split')
        overrides[20,21]=rec(p21,'TUB PRO 20:9 [canonical 20:21 clause]','split')
        overrides[20,22]=rec(p22,'TUB PRO 20:9 [canonical 20:22 clause]','split')
        skip(20,13)
        p13,p23=split_once(by[20][13],'Подвійна важка гидота')
        overrides[20,13]=rec(p13,'TUB PRO 20:13 [canonical 20:13 clause]','split')
        overrides[20,23]=rec(p23,'TUB PRO 20:13 [canonical 20:23 clause]','split')
        map_range(20,14,20,20,24)

        # Proverbs 31:25-26 are transposed in the supplied TUB module.
        mapv(31,25,31,26); mapv(31,26,31,25)

    elif bid=='psalms':
        # Hebrew Psalm 116:14 and 116:18 repeat the same vow formula. TUB's
        # LXX Psalm 115 keeps it only once (at source 115:9 -> Hebrew 116:18),
        # so reuse that exact Turkonjak line for the earlier canonical repeat.
        overrides[116,14]=rec(by[115][9],'TUB PSA 115:9 [canonical repeated 116:14 clause]','canonical repetition')

    elif bid=='ezekiel':
        fallback(1,14)
        overrides[1,28]=rec(' '.join((by[1][28],by[1][29])).strip(),'TUB EZK 1:28, TUB EZK 1:29','combined')

        # Ezekiel 7 has the same material as the Masoretic chapter, but the
        # opening judgement formula is rearranged.  Restore the display order
        # and split TUB 7:10 into canonical 7:6 and 7:10.
        skip_range(7,1,max(by[7]))
        mapv(7,1,7,1); mapv(7,2,7,2); mapv(7,7,7,3); mapv(7,8,7,4)
        fallback(7,5)
        p6,p10=split_once(by[7][10],'ось господний день.')
        overrides[7,6]=rec(p6,'TUB EZK 7:10 [end formula]','split')
        overrides[7,10]=rec(p10,'TUB EZK 7:10 [day/rod clause]','split')
        mapv(7,4,7,7); mapv(7,5,7,8); mapv(7,6,7,9)
        map_range(7,11,27,7,11)

        # Several empty TUB rows elsewhere in Ezekiel are not omissions: the
        # canonical verse is joined to the preceding source row. Split only at
        # exact reviewed phrases from the hash-pinned corpus.
        p3,p4=split_once(by[22][3],'ти переступило в їхній крові')
        overrides[22,3]=rec(p3,'TUB EZK 22:3 [canonical 22:3 clause]','split')
        overrides[22,4]=rec(p4,'TUB EZK 22:3 [canonical 22:4 clause]','split')
        p6,p7=split_once(by[24][6],'Бо його кров посеред нього')
        overrides[24,6]=rec(p6,'TUB EZK 24:6 [canonical 24:6 clause]','split')
        overrides[24,7]=rec(p7,'TUB EZK 24:6 [canonical 24:7 clause]','split')
        p2,rest=split_once(by[30][2],'бо близько господний день')
        p3,p4=split_once(rest,'І прийде меч')
        overrides[30,2]=rec(p2,'TUB EZK 30:2 [canonical 30:2 clause]','split')
        overrides[30,3]=rec(p3,'TUB EZK 30:2 [canonical 30:3 clause]','split')
        overrides[30,4]=rec(p4,'TUB EZK 30:2 [canonical 30:4 clause]','split')
        p3,p4=split_once(by[34][3],'Ви не скріплюєте слабке')
        overrides[34,3]=rec(p3,'TUB EZK 34:3 [canonical 34:3 clause]','split')
        overrides[34,4]=rec(p4,'TUB EZK 34:3 [canonical 34:4 clause]','split')

        # Ezekiel 32 is nearly verse-for-verse.  The sole substantial loss is
        # canonical 32:25; source 32:21 combines 19/21, while 22-23 split the
        # Asshur paragraph across the opposite boundary.
        skip_range(32,1,max(by[32]))
        map_range(32,1,18,32,1)
        mapv(32,20,32,20)
        p21,p19=split_once(by[32][21],'Від кого ти кращий?')
        overrides[32,21]=rec(p21,'TUB EZK 32:21 [mighty-men introduction]','split')
        overrides[32,19]=rec(p19,'TUB EZK 32:21 [canonical 32:19 clause]','split')
        p22,p23=split_once(by[32][22],'і їхний гріб в глибині ями')
        overrides[32,22]=rec(p22,'TUB EZK 32:22 [Asshur clause]','split')
        overrides[32,23]=rec(' '.join((p23,by[32][23])).strip(),'TUB EZK 32:22-23 [grave clause]','combined')
        mapv(32,24,32,24); fallback(32,25); map_range(32,26,32,32,26)

    elif bid=='esther':
        skip_range(1,1,17); map_range(1,18,39,1,1)
        prefix,_=split_once(by[3][13],'А зміст листа такий:')
        overrides[3,13]=rec(prefix,'TUB EST 3:13 [canonical clause]','split')
        skip_range(3,14,19); mapv(3,20,3,14); mapv(3,21,3,15)
        fallback(4,6)
        # Greek prayers and the expanded royal audience follow canonical 4:17.
        # Preserve the two canonical audience verses from that expanded block.
        skip_range(4,18,45)
        overrides[5,1]=rec(' '.join((by[4][31],by[4][36])).strip(),'TUB EST 4:31, TUB EST 4:36 [canonical audience clauses]','combined')
        overrides[5,2]=rec(' '.join((by[4][38],by[4][42])).strip(),'TUB EST 4:38, TUB EST 4:42 [canonical sceptre clauses]','combined')
        map_range(5,1,12,5,3)
        skip_range(8,13,36)
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
        # Several empty target rows are actually joined to the preceding TUB
        # verse. Split them only at exact phrases from the pinned source.
        a,b=split_once(by[1][6],'І Господь сказав до мене:')
        overrides[1,6]=rec(a,'TUB JER 1:6 [canonical 1:6 clause]','split')
        overrides[1,7]=rec(b,'TUB JER 1:6 [canonical 1:7 clause]','split')
        a,b=split_once(by[4][10],'В тому часі скажуть')
        overrides[4,10]=rec(a,'TUB JER 4:10 [canonical 4:10 clause]','split')
        overrides[4,11]=rec(b,'TUB JER 4:10 [canonical 4:11 clause]','split')
        a,b=split_once(by[14][13],'І Господь сказав до мене:')
        overrides[14,13]=rec(a,'TUB JER 14:13 [canonical 14:13 clause]','split')
        overrides[14,14]=rec(b,'TUB JER 14:13 [canonical 14:14 clause]','split')
        a,b=split_once(by[19][5],'Через це ось приходять дні')
        overrides[19,5]=rec(a,'TUB JER 19:5 [canonical 19:5 clause]','split')
        overrides[19,6]=rec(b,'TUB JER 19:5 [canonical 19:6 clause]','split')
        j2212,rest=split_once(by[22][12],'Він що будує свій дім')
        j2213,j2214a=split_once(rest,'Ти збудував собі гарний дім')
        overrides[22,12]=rec(j2212,'TUB JER 22:12 [canonical 22:12 clause]','split')
        overrides[22,13]=rec(j2213,'TUB JER 22:12 [canonical 22:13 clause]','split')
        overrides[22,14]=rec(' '.join((j2214a,by[22][13])).strip(),'TUB JER 22:12-13 [canonical 22:14 clauses]','combined')
        a,b=split_once(by[23][26],'Які задумують')
        overrides[23,26]=rec(a,'TUB JER 23:26 [canonical 23:26 clause]','split')
        overrides[23,27]=rec(b,'TUB JER 23:26 [canonical 23:27 clause]','split')
        a,b=split_once(by[32][17],'Ти, що чиниш милосердя')
        overrides[32,17]=rec(a,'TUB JER 32:17 [canonical 32:17 clause]','split')
        overrides[32,18]=rec(b,'TUB JER 32:17 [canonical 32:18 clause]','split')
        a,rest=split_once(by[34][5],'І Єремія сказав')
        b,c=split_once(rest,'І сила царя Вавилону')
        overrides[34,5]=rec(a,'TUB JER 34:5 [canonical 34:5 clause]','split')
        overrides[34,6]=rec(b,'TUB JER 34:5 [canonical 34:6 clause]','split')
        overrides[34,7]=rec(c,'TUB JER 34:5 [canonical 34:7 clause]','split')

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
        # Canonical 23:7-8 are duplicated at the end of the TUB chapter. Source
        # 23:27 itself is empty; canonical 23:27 was recovered above from 23:26.
        skip(23,7); skip(23,8); skip(23,27)
        mapv(23,41,23,7); mapv(23,42,23,8)
        # Five Masoretic verses are absent in the shorter LXX form.
        fallback(27,1,7,13,17,20)
        map_range(27,1,6,27,2); map_range(27,7,10,27,8)
        overrides[27,12]=rec(' '.join((by[27][10],by[27][11])).strip(),'TUB JER 27:10-11 [canonical 27:12 address to Zedekiah]','combined')
        map_range(27,11,13,27,14); map_range(27,14,15,27,18); map_range(27,16,17,27,21)
        # The supplied LXX text ends this chapter after canonical 33:13.
        fallback_range(33,14,26)
        # TUB 39:4-8 contain canonical 39:14-18. The capture/exile block is
        # absent here, but much of it is repeated verbatim in TUB Jeremiah 52.
        fallback_range(39,4,13); map_range(39,4,8,39,14)
        overrides[39,4]=rec(by[52][7],'TUB JER 52:7 [canonical repeated 39:4 event]','canonical repetition')
        overrides[39,5]=rec(' '.join((by[52][8],by[52][9])).strip(),'TUB JER 52:8-9 [canonical repeated 39:5 event]','canonical repetition')
        overrides[39,6]=rec(by[52][10],'TUB JER 52:10 [canonical repeated 39:6 event]','canonical repetition')
        overrides[39,7]=rec(by[52][11],'TUB JER 52:11 [canonical repeated 39:7 event]','canonical repetition')
        overrides[39,8]=rec(' '.join((by[52][13],by[52][14])).strip(),'TUB JER 52:13-14 [canonical repeated 39:8 event]','canonical repetition')
        overrides[39,10]=rec(by[52][16],'TUB JER 52:16 [canonical repeated 39:10 event]','canonical repetition')
        fallback_range(48,45,47)
        fallback(49,6); map_range(49,6,38,49,7)
        # 31:35-37 are present but appear in a 37,35,36 order.
        mapv(31,35,31,37); mapv(31,36,31,35); mapv(31,37,31,36)

        # Later MT locations repeat wording that is still preserved elsewhere
        # in this shorter LXX module. Reuse only exact canonical repetitions.
        overrides[8,11]=rec(by[6][14],'TUB JER 6:14 [canonical repeated 8:11 clause]','canonical repetition')
        overrides[8,12]=rec(by[6][15],'TUB JER 6:15 [canonical repeated 8:12 clause]','canonical repetition')
        j2218,j2219=split_once(by[22][18],'Похороном осла')
        overrides[22,18]=rec(j2218,'TUB JER 22:18 [canonical 22:18 clause]','split')
        overrides[22,19]=rec(j2219,'TUB JER 22:18 [canonical 22:19 clause]','split')
        overrides[30,10]=rec(by[46][27],'TUB JER 46:27 [canonical repeated 30:10 clause]','canonical repetition')
        overrides[30,11]=rec(by[46][28],'TUB JER 46:28 [canonical repeated 30:11 clause]','canonical repetition')
        overrides[30,22]=rec(by[32][38],'TUB JER 32:38 [canonical repeated 30:22 clause]','canonical repetition')

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
            if chapters is not None:
                book_blanks-=reviewed_exact_patches(chapters,by,bid)
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
