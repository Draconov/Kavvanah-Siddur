#!/usr/bin/env python3
"""Fill empty Russian Ashkenaz passages from reviewed, attributed Toldot excerpts."""
import argparse
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
EDITION = 'toldot-siddur-2011'


def apply(root=ROOT, check=False):
    manifest = json.loads((root/'scripts/translations/toldot.json').read_text())
    assert manifest['edition'] == EDITION
    path = root/'public/texts/ashkenaz.json'
    data = json.loads(path.read_text())
    count = 0
    for entry in manifest['entries']:
        assert entry['url'].startswith('https://toldot.com/articles/articles_')
        assert entry['ru'].strip()
        assert any(s['ref'] == entry['section'] and any(p['he'] == entry['he'] for p in s['paragraphs']) for s in data['sections']), entry['section']
        for section in data['sections']:
            for p in section['paragraphs']:
                if p['he'] != entry['he'] or (p.get('ru') and p.get('translationEditions', {}).get('ru') != EDITION):
                    continue
                if p.get('ru') != entry['ru']:
                    count += 1
                p['ru'] = entry['ru']
                p.setdefault('translationEditions', {})['ru'] = EDITION
                p.setdefault('translationRefs', {})['ru'] = entry['url']
    if not any(s.get('id') == EDITION for s in data['sources']):
        data['sources'].append({'id': EDITION, 'title': 'Толдот Йешурун', 'version': 'Толдот Йешурун — Перевод сидура (2011)', 'language': 'ru', 'license': manifest['permission'], 'url': 'https://toldot.com/cycles/cycles_321.html'})
    if check:
        assert data == json.loads(path.read_text()), 'Toldot translations need reapplying'
    else:
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n')
    return count


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    print('Russian passages added:', apply(check=parser.parse_args().check))
