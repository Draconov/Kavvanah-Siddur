import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('supplement_import', Path(__file__).parents[1]/'scripts/import-tanakh-supplement.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TanakhSupplementImportTests(unittest.TestCase):
    def test_addition_preserves_existing_published_translation(self):
        paragraph = {'he':'מוֹדֶה אֲנִי', 'ru':'Existing edition',
                     'translationRefs':{'ru':'Published 1'}, 'translationNotes':{'ru':'combined'}}
        entry = {'he':'מוֹדֶה אֲנִי','ru':'Благодарю','uk':'Дякую'}
        added = module.fill(paragraph, entry, 'KAV test')
        self.assertEqual(added, ['uk'])
        self.assertEqual(paragraph['ru'], 'Existing edition')
        self.assertEqual(paragraph['translationRefs']['ru'], 'Published 1')
        self.assertEqual(paragraph['translationNotes']['ru'], 'combined')
        self.assertEqual(paragraph['translationEditions']['uk'], module.EDITION_ID)

    def test_wrong_hebrew_cannot_receive_an_addition(self):
        paragraph = {'he':'מוֹדֶה אֲנִי'}
        with self.assertRaisesRegex(ValueError, 'Hebrew'):
            module.fill(paragraph, {'he':'שמע ישראל','ru':'Слушай, Израиль'}, 'KAV wrong')

    def test_reimport_is_idempotent_and_updates_own_text(self):
        paragraph = {'he':'מוֹדֶה אֲנִי'}
        entry = {'he':'מודה אני','ru':'Благодарю Тебя'}
        module.fill(paragraph, entry, 'KAV test')
        self.assertEqual(module.fill(paragraph, entry, 'KAV test'), [])
        entry['ru'] = 'Благодарю Тебя.'
        module.fill(paragraph, entry, 'KAV test')
        self.assertEqual(paragraph['ru'], 'Благодарю Тебя.')


if __name__ == '__main__':
    unittest.main()
