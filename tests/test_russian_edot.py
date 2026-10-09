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
        self.assertEqual(validate(ROOT)['ru'], {'ashkenaz': 3689, 'edot': 2924})

    def test_new_edited_entries_are_aligned_with_hebrew(self):
        anchors = (
            ('3e7b9375c6ff', 0, 'пробуждения'),
            ('64a4e1de2e05', 0, 'благословения'),
            ('00250f9bb81e', 15, 'Торе'),
            ('0c14859ce815', 2, 'пищи'),
            ('787c78ebd959', 1, 'Свитка'),
            ('3c6a5a4171f9', 27, 'Знающий тайны'),
            ('1fd551bae68b', 39, 'новомесячьем'),
            ('ad4207902bb8', 5, 'молитвы'),
            ('b9e7ef3e1086', 3, 'триста шестьдесят восемь'),
            ('25311d851ac2', 3, 'ханукальную'),
            ('37e2bf9d4a6e', 21, 'четвёртого года'),
            ('be9d4efb8302', 6, 'благословит тебя'),
        )
        for section_id, index, expected in anchors:
            with self.subTest(section=section_id, index=index):
                p = self.sections[section_id]['paragraphs'][index]
                self.assertTrue(p['he'].strip())
                self.assertIn(expected.casefold(), p['ru'].casefold())
                self.assertEqual(p['translationEditions']['ru'], 'kavvanah-russian-2026')

    def test_parallel_and_identical_source_are_populated(self):
        # A reused passage must retain the correct original Hebrew paragraph.
        for section_id, paragraph in (
            ('cde5f5f40f1c', 3),
            ('ad4207902bb8', 6),
            ('f85d66256ffd', 2),
            ('9dafa78e9161', 29),
        ):
            with self.subTest(section=section_id, index=paragraph):
                entry = self.sections[section_id]['paragraphs'][paragraph]
                self.assertTrue(entry['he'])
                self.assertGreater(len(entry['ru'].strip()), 40)

    def test_shabbat_zachor_cycle_completed(self):
        section = self.sections['4cf12ce50197']
        self.assertGreaterEqual(len(section['paragraphs']), 84)
        # This cycle was previously the largest single source of empty Russian fields.
        for index in range(2, 84):
            with self.subTest(paragraph=index):
                entry = section['paragraphs'][index]
                self.assertGreater(len(entry['ru'].strip()), 5)

    def test_newly_completed_prayer_anchors(self):
        samples = (
            ('64a4e1de2e05', 4, 'отверстия'),
            ('4eb0b95263fe', 9, 'изучение Торы'),
            ('6ad1acdddca9', 6, 'любовью вечной'),
            ('7bd62690e4c5', 1, 'наступают вечера'),
            ('8e7e09e82d8d', 3, 'седьмого дня'),
            ('9b8a89a2ef58', 8, 'сонмы ангелов'),
            ('37e2bf9d4a6e', 4, 'первую десятину'),
            ('60f8a6911c4f', 32, 'воскресении мёртвых'),
        )
        for section_id, index, phrase in samples:
            with self.subTest(section=section_id, index=index):
                entry = self.sections[section_id]['paragraphs'][index]
                self.assertIn(phrase.casefold(), entry['ru'].casefold())
                self.assertEqual(entry['translationEditions']['ru'], 'kavvanah-russian-2026')

    def test_latest_russian_edot_liturgical_anchors(self):
        # Representative completions across distinct services, without
        # duplicating the prayer text in the test suite.
        examples = (
            ('b9e7ef3e1086', 28, 'тринадцати правил'),
            ('38f41eea7611', 67, 'пост на завтра'),
            ('6ba649485e5b', 6, 'новолуние'),
            ('9b8a89a2ef58', 10, 'жертвенник'),
            ('0d00981a2dba', 2, 'Амали'),
            ('a35dd1a53bd5', 1, 'скрижали'),
        )
        for section_id, index, token in examples:
            with self.subTest(section=section_id, index=index):
                p = self.sections[section_id]['paragraphs'][index]
                self.assertIn(token.casefold(), p['ru'].casefold())
                self.assertTrue(p['he'].strip())

    def test_repeated_liturgical_text_is_consistent(self):
        repeated = (
            ('ad4207902bb8', 'c840e72b7095', 'bd9309b02bec'),
        )
        for group in repeated:
            variants = [self.sections[sid]['paragraphs'][1]['ru'] for sid in group]
            self.assertTrue(all(variants))
            self.assertEqual(len(set(variants)), 1)
        # Identical penitential prayer in four different fast services.
        prayer = [('191e107e3365', 3), ('e1d7dc789b9e', 7),
                  ('ac7acba7ca15', 2), ('c722fefb7f96', 9)]
        self.assertEqual(len({self.sections[sid]['paragraphs'][i]['ru'] for sid, i in prayer}), 1)

    def test_latest_nissan_and_mishnah_translations(self):
        # Each repeated Nissan prayer has its own source identity and tribal name.
        nissan = self.sections['9dafa78e9161']['paragraphs']
        unique = {
            7: 'Нахшона', 30: 'Нетанэля', 35: 'Элиава',
            39: 'Элицура', 44: 'Шелумиэля', 49: 'Эльясафа',
            59: 'Гамлиэля', 64: 'Авидана', 69: 'Ахиэзера',
            74: 'Пагиэля', 79: 'Ахиры', 85: 'светильниках',
        }
        for i, name in unique.items():
            with self.subTest(nissan=i):
                paragraph = nissan[i]
                self.assertIn(name, paragraph['ru'])
                self.assertGreater(len(paragraph['ru']), 500)
                self.assertEqual(paragraph['translationEditions']['ru'], 'kavvanah-russian-2026')
        # Complete, source-indexed Mishnah chapters — not abbreviated summaries.
        meal_chapters = (
            ('5905aec9d951', 5, 'Глава 4.'),
            ('88e3a3d97143', 5, 'Глава 21.'),
        )
        for section_id, i, heading in meal_chapters:
            paragraph = self.sections[section_id]['paragraphs'][i]
            self.assertTrue(paragraph['ru'].startswith(heading))
            self.assertGreater(len(paragraph['ru']), 900)

    def test_all_edot_translation_fields_populated(self):
        self.assertEqual(sum(len(s['paragraphs']) for s in self.edot['sections']), 2924)
        for section in self.edot['sections']:
            for index, paragraph in enumerate(section['paragraphs']):
                with self.subTest(section=section['id'], index=index):
                    self.assertTrue(paragraph['he'].strip())
                    self.assertTrue(paragraph['ru'].strip())

    def test_final_liturgical_passages(self):
        final_anchors = (
            ('461bccc6f8c7', 39, 'Бемидбар 28:1–15'),
            ('15c9786db824', 3, 'Песнью песней'),
            ('15c9786db824', 12, 'Святого святых'),
            ('5905aec9d951', 2, 'Глава 1.'),
            ('88e3a3d97143', 8, 'Глава 24.'),
            ('9dafa78e9161', 85, 'светильниках'),
            ('191e107e3365', 5, 'дом моего великолепия'),
        )
        for sid, index, phrase in final_anchors:
            with self.subTest(section=sid, index=index):
                paragraph = self.sections[sid]['paragraphs'][index]
                self.assertIn(phrase.casefold(), paragraph['ru'].casefold())
                self.assertEqual(paragraph['translationEditions']['ru'], 'kavvanah-russian-2026')

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
