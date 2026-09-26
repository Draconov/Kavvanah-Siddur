#!/usr/bin/env python3
"""Build the currently verified Turkonjak Tanakh subset from project-owner sources.

The supplied TUB SQLite module is the 1997–2007 Ukrainian Bible Society
Turkonjak translation based on the LXX. Only books whose chapter/verse shape
exactly matches Kavvanah's Hebrew-canon display are imported automatically.
Books with different LXX versification remain on the configured Ohiienko
fallback until a reviewed mapping is added.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sqlite3, tempfile, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/texts/translations/tanakh/uk-turkonjak-utt.json'
TUB_ZIP_SHA256='8d06571f18f118093bf1c73bb85f1ccd4723d99bc2261b162fc8984d7e4a9920'
XAPK_SHA256='a7785ae36da1498ca76de2c37188cff6e4ef2b570e3c50f750ed561db4689217'
XAPK_APK='by.uniq.ukrainska_biblia_turkoniak_2011.apk'
YES_ASSET='assets/internal/default_book/uk-utt--1.yes'
YES_MAGIC=bytes.fromhex('98580d0a005de003')
BOOKNUM={'genesis':10,'exodus':20,'leviticus':30,'numbers':40,'deuteronomy':50,'joshua':60,'judges':70,'ruth':80,'i-samuel':90,'ii-samuel':100,'i-kings':110,'ii-kings':120,'i-chronicles':130,'ii-chronicles':140,'ezra':150,'nehemiah':160,'esther':190,'job':220,'psalms':230,'proverbs':240,'ecclesiastes':250,'song-of-songs':260,'isaiah':290,'jeremiah':300,'lamentations':310,'ezekiel':330,'daniel':340,'hosea':350,'joel':360,'amos':370,'obadiah':380,'jonah':390,'micah':400,'nahum':410,'habakkuk':420,'zephaniah':430,'haggai':440,'zechariah':450,'malachi':460}

def sha(path:Path): return hashlib.sha256(path.read_bytes()).hexdigest()

def verify_xapk(path:Path):
    if sha(path)!=XAPK_SHA256: raise ValueError('Unreviewed Turkonjak XAPK revision')
    with zipfile.ZipFile(path) as x:
        apk=x.read(XAPK_APK)
    with zipfile.ZipFile(Path(tempfile.mkstemp(suffix='.apk')[1]),'w') as _: pass
    with tempfile.NamedTemporaryFile(suffix='.apk') as f:
        f.write(apk); f.flush()
        with zipfile.ZipFile(f.name) as z:
            yes=z.read(YES_ASSET)
            manifest=json.loads(z.read('assets/internal/default_book/manifest.json'))
    if yes[:8]!=YES_MAGIC: raise ValueError('Unexpected YES3 header')
    if manifest.get('presetName')!='uk-utt': raise ValueError('Unexpected Turkonjak preset')
    return len(yes)

def build(tub_zip:Path):
    if sha(tub_zip)!=TUB_ZIP_SHA256: raise ValueError('Unreviewed TUB source revision')
    with zipfile.ZipFile(tub_zip) as z:
        db_bytes=z.read('TUB.SQLite3')
    with tempfile.NamedTemporaryFile(suffix='.sqlite3') as f:
        f.write(db_bytes); f.flush(); con=sqlite3.connect(f.name)
        info=dict(con.execute('select name,value from info'))
        if info.get('language')!='uk' or 'Рафаїла Турконяка' not in info.get('description',''):
            raise ValueError('Unexpected TUB metadata')
        oh=json.loads((ROOT/'public/texts/translations/tanakh/uk-ohienko-1962.json').read_text())
        books={}; available=[]; total=0; blanks=0
        for bid,bn in BOOKNUM.items():
            base=json.loads((ROOT/'public/texts'/f'{bid}.json').read_text())
            rows=con.execute('select chapter,verse,text from verses where book_number=? order by chapter,verse',(bn,)).fetchall()
            by={}
            for ch,v,text in rows: by.setdefault(ch,{})[v]=re.sub(r'<[^>]+>','',text or '').strip()
            source_shape=[max(by.get(ch,{}) or {0:None}) for ch in range(1,len(base['text'])+1)]
            target_shape=[len(ch) for ch in base['text']]
            if source_shape!=target_shape: continue
            chapters=[]; available.append(bid)
            for ch_i,chapter in enumerate(base['text'],1):
                out=[]
                for v_i in range(1,len(chapter)+1):
                    text=by.get(ch_i,{}).get(v_i,'')
                    if text: out.append({'text':text,'ref':f'TUB {ch_i}:{v_i}'})
                    else:
                        rec=oh['books'][bid]['chapters'][ch_i-1][v_i-1]
                        fallback=rec['text'] if isinstance(rec,dict) else rec
                        out.append({'text':fallback,'ref':f'TUB {ch_i}:{v_i} [empty]; Ohiienko fallback','edition':'uk-ohienko-1962'}); blanks+=1
                    total+=1
                chapters.append(out)
            books[bid]={'chapters':chapters}
    bundle={'schema':1,'language':'uk','edition':'uk-turkonjak-utt','sources':[
      {'title':'Біблія · Рафаїл Турконяк','version':'Новий переклад УБТ Рафаїла Турконяка (1997–2007), LXX-based','language':'uk','license':'User-supplied source archive; source metadata states © 1997–2007 Рафаїл Турконяк, Українське Біблійне Товариство','url':'user-supplied 4205_TUB.zip / Turkonjak XAPK'},
      {'title':'Tanakh · Ukrainian · Ohiienko','version':'Огієнко 1962 (fallback only where the supplied Turkonjak module has an empty verse)','language':'uk','license':'User-supplied source','url':'https://www.bible.com/uk/versions/186'}], 'books':books}
    OUT.write_text(json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+'\n')
    return available,total,blanks

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--tub-zip',type=Path,required=True); ap.add_argument('--xapk',type=Path); args=ap.parse_args()
    if args.xapk: print('Verified embedded YES3 bytes:',verify_xapk(args.xapk))
    books,total,blanks=build(args.tub_zip); print(f'Turkonjak: {len(books)} books / {total} verses ({blanks} empty-source verse fallbacks) -> {OUT.relative_to(ROOT)}')
if __name__=='__main__': main()
