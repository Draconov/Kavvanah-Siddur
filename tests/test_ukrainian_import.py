import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('uk_import', Path(__file__).parents[1]/'scripts/import-ukrainian-translations.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class UkrainianImportTests(unittest.TestCase):
    def test_notes_and_section_headings_never_become_verses(self):
        source = '\\id GEN\n\\c 1\n\\p\n\\v 1 У початку.\\f + \\ft Editorial note.\\f*\n\\s1 Heading\n\\v 2 Наступний вірш.'
        self.assertEqual(module.parse_usfm(source), [{'chapter':1, 'verses':[
            {'verse':1,'text':'У початку.'}, {'verse':2,'text':'Наступний вірш.'}]}])

    def test_language_import_preserves_other_translations_and_provenance(self):
        target = {'sources':[{'language':'ru'}], 'text':[[{'he':'א','ru':'Первый','translationRefs':{'ru':'GEN 1:1'}},{'he':'ב','ru':'Второй'}]]}
        source = {'chapters':[{'chapter':1,'verses':[{'verse':1,'text':'Обидва.'}]}]}
        module.common.map_book('GEN',source,target,{('GEN',1,1):[('GEN',1,1),('GEN',1,2)]},'uk',module.SOURCE_META)
        self.assertEqual([p['ru'] for p in target['text'][0]], ['Первый','Второй'])
        self.assertEqual(target['text'][0][0]['translationRefs']['ru'],'GEN 1:1')
        for p in target['text'][0]:
            self.assertEqual(p['uk'],'Обидва.')
            self.assertEqual(p['translationNotes']['uk'],'combined')


if __name__ == '__main__':
    unittest.main()
