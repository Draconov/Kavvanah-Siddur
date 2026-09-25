"""Import explicitly licensed source editions from Sefaria's public export.

No API credentials required. Downloaded raw editions remain in .text-cache/.
The application ships normalized text and full edition attribution.
"""
import concurrent.futures, hashlib, html, json, re, time, urllib.parse, urllib.request
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from html.parser import HTMLParser

ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'.text-cache'
OUT=ROOT/'public'/'texts'; OUT.mkdir(parents=True,exist_ok=True)
BASE='https://storage.googleapis.com/sefaria-export/'
ALLOWED={'Public Domain','PD','CC0','CC-BY','CC-BY-SA'}

def fetch(path):
    CACHE.mkdir(exist_ok=True)
    target=CACHE/(hashlib.sha256(path.encode()).hexdigest()+'.json')
    if target.exists(): return json.loads(target.read_text())
    url=BASE+urllib.parse.quote(path)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url,timeout=45) as response: data=json.load(response)
            if data.get('license') not in ALLOWED:
                raise ValueError('Unapproved license: '+str(data.get('license'))+' in '+path)
            target.write_text(json.dumps(data,ensure_ascii=False))
            return data
        except Exception:
            if attempt==2: raise
            time.sleep(1)

class TextCleaner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts=[]; self.skip=0
    def handle_starttag(self,tag,attrs):
        void=tag in {'br','hr','img','input','meta','link','wbr'}
        classes=dict(attrs).get('class','').split()
        if self.skip:
            if not void:self.skip+=1
        elif tag=='sup' or 'footnote' in classes:
            if not void:self.skip=1
        elif tag=='br':self.parts.append('\n')
    def handle_endtag(self,tag):
        if self.skip and tag not in {'br','hr','img','input','meta','link','wbr'}:self.skip-=1
    def handle_data(self,data):
        if not self.skip:self.parts.append(data)

def clean(value):
    if not isinstance(value,str) or value.strip()=='[]':return ''
    parser=TextCleaner();parser.feed(str(value));parser.close()
    return re.sub(r'[ \t]+',' ',''.join(parser.parts)).strip()

def source(data):
    return {'title':data['title'],'version':data['versionTitle'],'language':data.get('actualLanguage',data['language']),
            'license':data.get('license',''),'url':'https://www.sefaria.org/'+data['title'].replace(' ','_')+'?ven='+urllib.parse.quote(data['versionTitle'])}

def getpath(data,path):
    for key in path:
        if not isinstance(data,dict): return []
        data=data.get(key,[])
    return data if isinstance(data,list) else []

def flat(array):
    result=[]
    for x in array:
        if isinstance(x,list):result.extend(flat(x) if x else [''])
        else:result.append(clean(x))
    return result

def category(path):
    text=' / '.join(path).lower(); first=path[0].lower()
    if 'shabbat' in text or 'havdalah' in text or 'meal' in text:return 'Shabbat'
    if first=='festivals' or any(w in first for w in ['hodesh','omer','moon','festivals','hanukkah','purim','nissan','fast days']):return 'Festivals'
    if any(w in first for w in ['berachot','blessings','hamihya']):return 'Blessings'
    if 'kaddish'==first:return 'Kaddish'
    if 'mincha' in text:return 'Afternoon'
    if any(w in text for w in ['maariv','arvit','bedtime']):return 'Evening'
    if 'shacharit' in text or 'preparatory' in text:return 'Morning'
    return 'Other'

from siddur_translation_io import preserve_existing_editions, save_siddur, strip_translations

def siddur(nusach,title,he_versions,en_version):
    prefix='json/Liturgy/Siddur/'+title+'/'
    hebrew=[fetch(prefix+'Hebrew/'+v+'.json') for v in he_versions]
    english=fetch(prefix+'English/'+en_version+'.json')
    titles={}
    def schema(node,path=[]):
        current=path+([node['enTitle']] if path or node.get('enTitle')!=title else [])
        titles[tuple(current)]=node.get('heTitle','')
        for child in node.get('nodes',[]):schema(child,current)
    schema(hebrew[0]['schema'])
    allpaths=[]
    def walk(node,path=[]):
        if isinstance(node,dict):
            for key,value in node.items():walk(value,path+[key])
        elif isinstance(node,list) and tuple(path) not in allpaths:allpaths.append(tuple(path))
    for version in hebrew:walk(version['text'])
    sections=[]
    for path in allpaths:
        candidates=[flat(getpath(v['text'],path)) for v in hebrew]
        hi=next((i for i,x in enumerate(candidates) if any(x)),None)
        if hi is None:continue
        he=candidates[hi]; en=flat(getpath(english['text'],path))
        raw_he=getpath(hebrew[hi]['text'],path)
        # A different edition can segment paragraphs differently: do not misalign.
        aligned=len(en)==len(he)
        paragraphs=[{'he':h,**({'kind':'instruction'} if i<len(raw_he) and isinstance(raw_he[i],str) and re.match(r'^\s*<(?:small|big)[^>]*>.*</(?:small|big)>\s*$',raw_he[i],re.S) else {}),**({'en':en[i]} if aligned and i<len(en) and en[i] else {})} for i,h in enumerate(he) if h]
        if not paragraphs:continue
        sections.append({'id':hashlib.sha1('/'.join(path).encode()).hexdigest()[:12],
          'title':path[-1], 'heTitle':titles.get(path,''),'category':category(path),
          'service':' / '.join(path[:2]),'path':list(path),'ref':title+', '+', '.join(path),
          'paragraphs':paragraphs,'hebrewEdition':hebrew[hi]['versionTitle']})
    data={'title':title,'nusach':nusach,'sources':[source(v) for v in hebrew]+[source(english)],'sections':sections}
    # The source Edot Mincha English has one empty Hebrew slot omitted from its
    # segmentation. Correct that known alignment structurally rather than storing
    # duplicate English prose in a repair manifest.
    if nusach == 'edot':
        ref='Siddur Edot HaMizrach, Weekday Mincha, Amida'
        section=next((s for s in data['sections'] if s['ref']==ref),None)
        if section is not None:
            paragraphs=section['paragraphs']
            if len(paragraphs) > 25 and paragraphs[15]['he'].startswith('רְפָאֵנוּ') and paragraphs[16]['he']=='בקיץ:' and paragraphs[25]['he'].startswith('בתשעה באב'):
                # Raw source alignment has the English for paragraph N on N+1
                # across this range. Shift existing source values back one slot.
                values=[paragraphs[i].get('en') for i in range(16,26)]
                for target,value in zip(range(15,25),values):
                    if value: paragraphs[target]['en']=value
                    else: paragraphs[target].pop('en',None)
                paragraphs[25].pop('en',None)
    # Reapply reviewed non-translation corrections by exact Hebrew identity.
    import runpy
    runpy.run_path(str(Path(__file__).with_name('repair-texts.py')))['apply_repairs'](data,nusach)
    if OUT.resolve() == (ROOT/'public/texts').resolve():
        # Canonical project-authored additions live only in translations/en.json.
        # Preserve them when refreshing the public-source English import.
        preserve_existing_editions(ROOT,nusach,data,'en',{'kavvanah-supplement-2026'})
        save_siddur(ROOT, nusach, data, languages=('en',))
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT/(nusach+'.json')).write_text(json.dumps(strip_translations(data),ensure_ascii=False,separators=(',',':')))
    print(nusach,len(sections),'sections',sum(len(s['paragraphs']) for s in sections),'paragraphs',flush=True)
    return strip_translations(data)

BOOKS=[
 ('Torah','Genesis'),('Torah','Exodus'),('Torah','Leviticus'),('Torah','Numbers'),('Torah','Deuteronomy'),
 *[('Prophets',x) for x in ['Joshua','Judges','I Samuel','II Samuel','I Kings','II Kings','Isaiah','Jeremiah','Ezekiel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi']],
 *[('Writings',x) for x in ['Psalms','Proverbs','Job','Song of Songs','Ruth','Lamentations','Ecclesiastes','Esther','Daniel','Ezra','Nehemiah','I Chronicles','II Chronicles']]
]

def book(item):
    category,title=item; prefix='json/Tanakh/'+category+'/'+title+'/'
    he=fetch(prefix+'Hebrew/Tanach with Nikkud.json')
    en=fetch(prefix+'English/The Holy Scriptures A New Translation JPS 1917.json')
    info={'id':title.lower().replace(' ','-'),'title':title,'heTitle':he.get('heTitle',''),'category':category,'chapters':len(he['text'])}
    text=[]
    for ci,chapter in enumerate(he['text']):
        eng=en['text'][ci] if ci<len(en['text']) else []
        text.append([{'he':clean(h),**({'en':clean(eng[i])} if i<len(eng) and eng[i] else {})} for i,h in enumerate(chapter)])
    data={**info,'sources':[source(he),source(en)],'text':text}
    (OUT/(info['id']+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
    print(title,len(text),'chapters',flush=True)
    return info

if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        book_futures=[pool.submit(book,item) for item in BOOKS]
        siddur_futures=[
          pool.submit(siddur,'ashkenaz','Siddur Ashkenaz',['The Metsudah siddur a new linear siddur with English translation by Avrohom Davis, 1981','The Metsudah siddur, 1981','Daat Siddur Ashkenaz'],'Translation based on the Metsudah linear siddur, by Avrohom Davis, 1981'),
          pool.submit(siddur,'edot','Siddur Edot HaMizrach',['Torat Emet 357'],'Sefaria Community Translation')]
        books=[f.result() for f in book_futures]
        prayers=[f.result() for f in siddur_futures]
    (OUT/'catalog.json').write_text(json.dumps({'books':books,'prayers':[{k:v for k,v in p.items() if k!='sections'} for p in prayers]},ensure_ascii=False,separators=(',',':')))
    print('COMPLETE',len(books),'volumes',sum(b['chapters'] for b in books),'chapters',flush=True)
