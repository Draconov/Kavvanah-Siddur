"""Permanent Ukrainian Siddur data / source-alignment regression checks.

The translations are canonical in public/texts/translations/uk.json. These tests
verify retained population, metadata source pins, corrected passage fingerprints,
and source/target collision heuristics, without copying the translations again.
"""
import hashlib
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from siddur_translation_io import load_siddur, validate

# Compact SHA-256 locks for the 40 explicitly reviewed paragraph corrections.
# Each row: nusach, section ID, paragraph index, Hebrew SHA-256, Ukrainian SHA-256.
REVIEWED_ANCHORS = [
    ('ashkenaz', 'f6ceed84935d', 0, '453d2b485454ef4f2b166497f7b9f767ddb7f4512ece6e74dd7887700c7945bd', '7095254bd6de6d3475da4a2b3c050a147c886a9b5436e8c1ab9af020528e978b'),
    ('ashkenaz', '2a031b9742de', 1, 'b819628b6d2f1757a08f2b15a6d1af8b2d8ea28084f390089f3c1339b901f28c', '984a77c5358280bb685d0f1b48d4781935d0df8c7625a403ab353460222f78ba'),
    ('ashkenaz', '2a031b9742de', 3, 'a5b0f922f04159cb0ddb2a93408f7b720b6d9b69cbd174f686ec9ff227758f2a', '40a941d41dcac66c8fc26bfa80c006264785d66a7599364b8ceeb760bdb67f52'),
    ('ashkenaz', '1617a8dff62c', 0, 'be3b1de44b17e4a2f3c15a3f1e2cc183b7f1b211a079afaf86441199294f43a9', 'a400abd62c628140a84846a750dc4c2d32f601fb64f253676448673a977873fc'),
    ('ashkenaz', '33bae1710652', 0, '9580545ca96fbbf0bde119f86c5cd1dad803b50a8514f563875bce1725f402b7', 'e75cd95386ad177aa975fe36fdd9e5ad17e495701308a5e2fe602d02304ff0b4'),
    ('ashkenaz', '51349d85867d', 1, '4d9713e52ac16f848f6e1e13b1aa13024a8612b062c78d136b9361d449b5d6e9', '2915aaec37435c0e70f08f9c20c8f5e409b477773efc6e9b3fa82a1b476268d2'),
    ('ashkenaz', '7785a3c23eea', 0, '9580545ca96fbbf0bde119f86c5cd1dad803b50a8514f563875bce1725f402b7', 'e75cd95386ad177aa975fe36fdd9e5ad17e495701308a5e2fe602d02304ff0b4'),
    ('ashkenaz', 'a91a71aac839', 4, '659f39e8274dc35ebcc0ae45883df457d9d27f958f6a203caea96212f4179129', '7c2998445a36d7c7893c64bf36719cb2901b792a8768b09ff54b24d3acf10c2b'),
    ('ashkenaz', '0f4977b5d179', 0, 'b81ff01208db8edd41f10d71891ee1d3db09bdfb5556098c752f30e6f3ed6bf7', '351a5656c9c2040b2720f984bbd736ad3642a9b03ff2aa680a90ed176b1f2a33'),
    ('ashkenaz', '631905a05d25', 0, 'cd9027e36ec8623fdc5da0467ca52d602099e7fac69d2d1d4f6d6ada145283a5', 'd4537384755bfe13af942307af334ec1f3a081c433cd5c4c0fcc92a921d18c63'),
    ('ashkenaz', '5c515b757618', 3, '9b8340e2994bf54c16b39479bab9c813e1330e9eb9d4e6636c1ecdcfcce1cd1c', '5e824edac618bd640c8ae1e2e26bfa90987846887657f4d8bd9c16bdc3e7db29'),
    ('ashkenaz', '028fd75211c6', 0, 'b0ebe25f15ac127c98a439615ea555f85e51a9cb856a680dbd818f3a8d9cb744', '7095254bd6de6d3475da4a2b3c050a147c886a9b5436e8c1ab9af020528e978b'),
    ('ashkenaz', '71ccfbb94164', 0, '76fe6f7160059e02dd5321a20f4e7f83d6a0dbb05ef10396f46f2edd8c158f85', 'a075e1dc8d645feb1e6c7cc9c90337932535c18e3e1ce9af4a68a159e5337e7e'),
    ('ashkenaz', '71ccfbb94164', 2, '58281d85c6ecb8bc815073e8abd11f0c0cfa2425ea162d1510ee3b45f24e7451', 'd2b4aebfd3611c53b56f8094c33ebc6798b682b2e161dfddd089d778a97bcb95'),
    ('ashkenaz', '296121472301', 2, '3d77d072c5256dca9d8043fc45793d1147b555a71c90fc3eb5bbd49a8c732212', 'd3a0bf2dfd14b6ed60fbf6b70d1f38d0d0b5fe2e2e8fc897396faf2ddd5200ec'),
    ('ashkenaz', 'c7f9bcc0b942', 0, 'f9df0c67cb775f3281d5e89b09ac6b1023214ec030991eef46d5374045e07e8c', '5b3796bb8f5a23c2ecb270a316e05409014707523d935756e67a18f155fc00a1'),
    ('ashkenaz', '1e55b8ce9dff', 7, 'faa01ef9490b9465778d2cea0647ecdd1e8b94fdb03f2697f2583d3e5086adc0', '2412208731984fa84cb0cbf17abd1b907d5961f77ab44ccb6b203a60977bb9e2'),
    ('ashkenaz', 'b82eccce0472', 0, '94b845ca1f1b0df813b5cc76cd3e6299fa3110a31011d3ede9d7a6e30fba86c2', 'a400abd62c628140a84846a750dc4c2d32f601fb64f253676448673a977873fc'),
    ('ashkenaz', 'b82eccce0472', 1, '721244900efd8b5efa6121a02f16a294c8e13d6a5dce3200ebcd5146e0354c9b', '71cfc5cd74bfe4b3ccf1ca665e330daad0f1a1509554a6dcac863ef002d2b37b'),
    ('ashkenaz', 'b82eccce0472', 2, 'd979d5f64c48e44f3ecf8cfb19e6de311d5a41bb00b9d5326b3080f8cb64c98b', 'e172c0cea1e0ada3a89036e1e23605e4eae972dd27c4932e8799cbae30b442ce'),
    ('ashkenaz', '014712362482', 1, '9d75d10a56491903b9d1ff8f1e6ced7a447c122fc06bf7cbe4521e2c6fccc56c', '0116931c5f33aa68cac525ccbbaa6a194b27aea385171af7598d8ff5be03d9b6'),
    ('ashkenaz', 'c51f824316d1', 1, 'a6dd13e4b86065aac366409d61ccd4423f399a225f1a37aec7da4b6bf54f29c0', 'bafbf1cd8db70e1d17b8798bbb7d14be9c3ba2fd552ec00273c1edb446f590b9'),
    ('ashkenaz', '81f4f51fd2af', 0, '956897fd840966459cc37eca2388772904953780bc574bee6fc4cf19012e2877', '20fe0f648f673d70646f4ee925608340826983aea1f58d48ea6ad6f12ab3a071'),
    ('ashkenaz', 'b64433896c2d', 0, 'cceb8ea960f7c5564febda8fab56d3ead0dcdede7f72be969ff6b028bc995b42', '5b3796bb8f5a23c2ecb270a316e05409014707523d935756e67a18f155fc00a1'),
    ('ashkenaz', '75d88385d50e', 0, '7498497026eea26f2cbf0e317f94e41650d4e354fca7d275db25ed694746b520', 'dfda609f8de07982c1348fac7e8a35fe9fc63bd9b44ad3f173ae357ecf2745bd'),
    ('ashkenaz', 'dc7191841f8c', 0, '2d6823d08ef144eccf7c0af489aa6d481e66aa91ff80c299937c76e87620cfa9', '5f8009d2c180cff87bb98244a17332e7b0027021482a71248938f3296ba21d2c'),
    ('ashkenaz', '2a031b9742de', 4, '28d88507990e2d3b0911fe798992b08ff84949a6eb7f07364b0a49dec6ceff33', '896b7546343027d1dceb0d469e0d0b3b8b4517844f36a4ab3e13c2d0e2128bb0'),
    ('ashkenaz', '2a031b9742de', 6, 'c8ceb671c8536e6e30a41fd721885e836e4a12040f8fc34b8095b7f01589c4cc', '92e687910319be8c353db8ec8b4e530188d65f1b7d4004e24256bc92736561ac'),
    ('ashkenaz', '91d5739e2b40', 7, '4f98e1a250a11a4df7dcc485eea13ec1f194f13acacd6f7365b350ed64604494', 'f3b542a6f94b73e1021b32bb560dc10bc868aa5f3e8aad341bfbf32e820d59ad'),
    ('ashkenaz', '91d5739e2b40', 8, 'a39247359eb0ed05e7a9fc90053a977244b126dfd6b22cbd0fad37cafe6b6909', '77075281df361d979076b3c392e52cbd09c498bce894524baf712f4299a8a254'),
    ('ashkenaz', '932a4dc21697', 1, '7fad924cbf2f3a89197fcb32d22e7a66c532c060b0d37f80ab9e6c001eee9cdc', '5a92a43d2cce53f5dd4698e7b303068d5d56a038114cfdb299c4b6b22cca6a09'),
    ('ashkenaz', '496817c3fdbe', 10, '62c32434dee8267633665c8cc759b8b3fb8e47d955e50e115e290d06044b560d', 'ba9f827d06d03f7cf2e12c3411b51ef4d3c457a7510fec772963e9b4c7a746fa'),
    ('ashkenaz', '496817c3fdbe', 16, '8efb863330ce7777a3f77d1f3bb4fc638de233b1fc9e6caac9e92afd5aaf78f7', 'c24aaaf3a17750eef787dae265b784fec4e25e396ac8ace6c608e60e1bcca208'),
    ('ashkenaz', '6e47a044530c', 5, '5c4cb1c59e96de9f06d7eb7a14bee9ddc18cbd55f3b0196263da36c95026b53f', 'ba9f827d06d03f7cf2e12c3411b51ef4d3c457a7510fec772963e9b4c7a746fa'),
    ('ashkenaz', 'bb9152027ee0', 1, 'bc4275f908caa23edc6a795378c7a2e2bcfa92c99473fb2e4784b68706fd80b4', 'fd3d5e6526e43f9385e444cc8411b4d88d6c5446bcac0a6851d76dd152398d2a'),
    ('ashkenaz', '4c578edc3e88', 1, 'fb6ae8408158cdc835c25de19e6a338156bd5d83ca784f31532a3f8b4bcbc5d8', '829894536bcd91d8638fa3c35059e5cb081fae078007ef6702df1f6411c0aa23'),
    ('ashkenaz', 'd1cfb6f5592d', 0, 'fb6ae8408158cdc835c25de19e6a338156bd5d83ca784f31532a3f8b4bcbc5d8', '829894536bcd91d8638fa3c35059e5cb081fae078007ef6702df1f6411c0aa23'),
    ('ashkenaz', '935c14d45f5f', 0, '7498497026eea26f2cbf0e317f94e41650d4e354fca7d275db25ed694746b520', 'dfda609f8de07982c1348fac7e8a35fe9fc63bd9b44ad3f173ae357ecf2745bd'),
    ('ashkenaz', 'd4cc2308726b', 10, '62c32434dee8267633665c8cc759b8b3fb8e47d955e50e115e290d06044b560d', 'ba9f827d06d03f7cf2e12c3411b51ef4d3c457a7510fec772963e9b4c7a746fa'),
    ('ashkenaz', '4c578edc3e88', 0, 'abeea1a53f084d714a589b8f11048b7645d64a64c15e8ded3b7c845ba1005a4c', '17e2fb4daab5a3f93000508f589329bfb550ab76c8d5b36793b14927c4164b16'),
]


class UkrainianSiddurTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data={n:load_siddur(ROOT,n,languages=('uk',)) for n in ('ashkenaz','edot')}
        cls.byid={n:{section['id']:section for section in data['sections']}
                  for n,data in cls.data.items()}

    def get(self,nusach,sid,index):
        return self.byid[nusach][sid]['paragraphs'][index]

    def test_full_ukrainian_coverage_without_padding(self):
        self.assertEqual(validate(ROOT)['uk'],{'ashkenaz':3689,'edot':2924})
        for nusach,data in self.data.items():
            for section in data['sections']:
                for i,p in enumerate(section['paragraphs']):
                    with self.subTest(nusach=nusach,section=section['id'],index=i):
                        self.assertTrue(p['uk'].strip())
                        self.assertNotIn('[TODO]',p['uk'])
                        self.assertNotIn('переклад відсутній',p['uk'].lower())

    def test_other_language_coverage_unchanged(self):
        totals=validate(ROOT)
        self.assertEqual(totals['ru'],{'ashkenaz':3689,'edot':1700})
        self.assertEqual(totals['en'],{'ashkenaz':1779,'edot':1732})

    def test_part_provenance_source_pins_remain_valid(self):
        """Provenance remains inside canonical records, not duplicated manifests."""
        counts={'PART4':0,'PART5':0,'PART6':0}
        for section in self.data['edot']['sections']:
            for i,p in enumerate(section['paragraphs']):
                ref=p.get('translationRefs',{}).get('uk','')
                parts=ref.split()
                if len(parts)<5 or parts[:2]!=['KAV','EDOT'] or parts[2] not in counts:
                    continue
                key=f"{section['id']}:{i}"
                with self.subTest(key=key,part=parts[2]):
                    self.assertEqual(parts[3],key)
                    self.assertEqual(parts[4],hashlib.sha256(p['he'].encode()).hexdigest()[:16])
                    self.assertEqual(p.get('translationEditions',{}).get('uk'),'kavvanah-supplement-2026')
                counts[parts[2]]+=1
        self.assertEqual(counts,{'PART4':194,'PART5':71,'PART6':109})

    def test_all_proofread_replacements_locked(self):
        self.assertEqual(len(REVIEWED_ANCHORS),40)
        self.assertEqual(len({(n,s,i) for n,s,i,*_ in REVIEWED_ANCHORS}),40)
        for n,sid,index,he_sha,uk_sha in REVIEWED_ANCHORS:
            with self.subTest(n=n,section=sid,index=index):
                p=self.get(n,sid,index)
                self.assertEqual(hashlib.sha256(p['he'].encode()).hexdigest(),he_sha)
                self.assertEqual(hashlib.sha256(p['uk'].encode()).hexdigest(),uk_sha)

    def test_repaired_reading_anchors(self):
        for sid,i,prefix in [('f6ceed84935d',0,'Великою любов’ю'),
                ('1617a8dff62c',0,'Склад пахощів'),
                ('0f4977b5d179',0,'Славте Господа'),
                ('014712362482',1,'Хазан:'),
                ('81f4f51fd2af',0,'І прийде до Сіону'),
                ('75d88385d50e',0,'Вічною любов’ю'),
                ('91d5739e2b40',7,'Господь, Господь')]:
            self.assertTrue(self.get('ashkenaz',sid,i)['uk'].startswith(prefix))

    def test_short_alignment_warnings_absent(self):
        for nusach,data in self.data.items():
            flags=[(s['id'],i) for s in data['sections'] for i,p in enumerate(s['paragraphs'])
                   if len(p['he'])>=150 and len(p['uk'].strip()) / len(p['he'])<0.30]
            self.assertEqual(flags,[],nusach)

    def test_semantic_heuristics_detect_no_collisions(self):
        spec=importlib.util.spec_from_file_location('siddur_validation',ROOT/'scripts/validate-siddur-translations.py')
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        result=mod.ukrainian_semantic_audit()
        self.assertEqual(result['identicalUkrainianOnUnrelatedHebrew'],[])
        self.assertEqual(result['similarHebrewDivergentUkrainianLengths'],[])

if __name__=='__main__': unittest.main()
