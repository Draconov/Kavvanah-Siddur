"""Maintain Russian Edot HaMizrach coverage and source alignment.

The canonical translation is public/texts/translations/ru.json; this suite
references selected editorially reviewed entries rather than duplicating text.
"""
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / 'scripts'))
from siddur_translation_io import load_siddur, validate


class RussianEdotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.edot = load_siddur(ROOT, 'edot', languages=('ru',))
        cls.sections = {section['id']: section for section in cls.edot['sections']}

    def test_coverage_is_monotonic(self):
        # Raises the pinned coverage only after newly authored translations land.
        self.assertEqual(validate(ROOT)['ru'], {'ashkenaz': 3689, 'edot': 2110})

    def test_new_edited_entries_are_aligned_with_hebrew(self):
        anchors = (
            ('3e7b9375c6ff', 0, 'пробуждения'),
            ('64a4e1de2e05', 0, 'благословения'),
            ('00250f9bb81e', 15, 'Торе'),
            ('0c14859ce815', 2, 'пищи'),
            ('787c78ebd959', 1, 'Свитка'),
            ('3c6a5a4171f9', 27, 'Знающий тайны'),
            ('1fd551bae68b', 39, 'новомесячьем'),
        )
        for section_id, index, expected in anchors:
            with self.subTest(section=section_id, index=index):
                p = self.sections[section_id]['paragraphs'][index]
                self.assertTrue(p['he'].strip())
                self.assertIn(expected.casefold(), p['ru'].casefold())
                self.assertEqual(p['translationEditions']['ru'], 'kavvanah-russian-2026')

    def test_no_placeholder_translations(self):
        for section in self.edot['sections']:
            for i, p in enumerate(section['paragraphs']):
                ru = (p.get('ru') or '').lower()
                with self.subTest(section=section['id'], index=i):
                    self.assertNotIn('[todo]', ru)
                    self.assertNotIn('translation missing', ru)
                    self.assertNotIn('перевод отсутствует', ru)


if __name__ == '__main__':
    unittest.main()
