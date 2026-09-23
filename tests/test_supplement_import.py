import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('supplement_import', Path(__file__).parents[1]/'scripts/import-translation-supplement.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SupplementImportTests(unittest.TestCase):
    def test_addition_preserves_published_text_and_every_other_language(self):
        paragraph = {'he':'מוֹדֶה אֲנִי', 'en':'I give thanks', 'ru':'Existing edition',
                     'translationRefs':{'ru':'Published 1'}, 'translationNotes':{'ru':'combined'}}
        entry = {'he':'מוֹדֶה אֲנִי','ru':'Благодарю','uk':'Дякую'}
        before = dict(paragraph)
        added = module.fill(paragraph, entry, 'KAV test')
        self.assertEqual(added, ['uk'])
        self.assertEqual(paragraph['ru'], before['ru'])
        self.assertEqual(paragraph['he'], before['he'])
        self.assertEqual(paragraph['en'], before['en'])
        self.assertEqual(paragraph['translationRefs']['ru'], 'Published 1')
        self.assertEqual(paragraph['translationNotes']['ru'], 'combined')
        self.assertEqual(paragraph['translationEditions']['uk'], module.EDITION_ID)
        self.assertEqual(paragraph['translationRefs']['uk'], 'KAV test')

    def test_wrong_hebrew_cannot_receive_an_addition(self):
        paragraph = {'he':'מוֹדֶה אֲנִי'}
        with self.assertRaisesRegex(ValueError, 'Hebrew'):
            module.fill(paragraph, {'he':'שמע ישראל','ru':'Слушай, Израиль'}, 'KAV wrong')
        self.assertEqual(paragraph, {'he':'מוֹדֶה אֲנִי'})

    def test_reimport_is_idempotent_and_updates_only_its_own_text(self):
        paragraph = {'he':'מוֹדֶה אֲנִי'}
        entry = {'he':'מודה אני','ru':'Благодарю Тебя'}
        module.fill(paragraph, entry, 'KAV test')
        self.assertEqual(module.fill(paragraph, entry, 'KAV test'), [])
        entry['ru'] = 'Благодарю Тебя.'
        module.fill(paragraph, entry, 'KAV test')
        self.assertEqual(paragraph['ru'], 'Благодарю Тебя.')

    def test_instruction_and_prayer_keys_are_distinct_and_missing_data_rejected(self):
        self.assertNotEqual(module.key({'he':'מודה אני'}), module.key({'he':'מודה אני','kind':'instruction'}))
        with self.assertRaises(ValueError):
            module.fill({'he':'מודה אני'}, {'he':'מודה אני','uk':'   '}, 'KAV empty')

    def test_divine_name_normalization_keeps_non_hebrew_instructions(self):
        self.assertEqual(module.reuse_key("בָּרוּךְ ה'"), module.reuse_key('ברוך יהוה'))
        self.assertNotEqual(module.reuse_key('repeat 2x ברוך יהוה'), module.reuse_key('ברוך יהוה'))

    def test_incomplete_biblical_reuse_is_rejected(self):
        paragraph = {'he':'ברוך יהוה לעולם'}
        entry = {'id':module.key(paragraph),'ru':{'text':'Благословен Господь','refs':'Fixture 1:1','evidence':{
            'fullTargetCoverage':True,'targetCanonical':module.reuse_key(paragraph['he']),
            'sourceCanonical':module.reuse_key('ברוך יהוה'), 'segments':[]}}}
        with self.assertRaisesRegex(ValueError, 'complete Hebrew'):
            module.fill_reused(paragraph, entry)
        self.assertNotIn('ru', paragraph)


if __name__ == '__main__':
    unittest.main()
