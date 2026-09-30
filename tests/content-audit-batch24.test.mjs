import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))

const ukAudit = readJson('scripts/translations/ukrainian-edition-audit.json')
const coverageAudit = readJson('scripts/translations/siddur-coverage-audit.json')
const translitAudit = readJson('scripts/translations/transliteration-audit.json')

const siddurBundles = {
  en: readJson('public/texts/translations/en.json'),
  ru: readJson('public/texts/translations/ru.json'),
  uk: readJson('public/texts/translations/uk.json'),
}

function countTranslated(bundle, edition) {
  const sections = bundle?.corpora?.[edition]?.sections ?? {}
  let count = 0
  for (const section of Object.values(sections)) {
    for (const entry of section?.paragraphs ?? []) {
      const text = typeof entry === 'string' ? entry : entry?.text
      if (typeof text === 'string' && text.trim()) count += 1
    }
  }
  return count
}

test('Batch 24 Ukrainian edition audit certifies all four choices and the Jewish modern composite', () => {
  assert.equal(ukAudit.expected.books, 39)
  assert.equal(ukAudit.expected.verses, 23206)
  for (const id of ['uk-jewish-modern', 'uk-ohienko-1962', 'uk-turkonjak-utt', 'uk-kulish-puluj-1905']) {
    assert.equal(ukAudit.editions[id].verses, 23206, id)
    assert.equal(ukAudit.editions[id].empty, 0, id)
  }
  assert.equal(ukAudit.jewishModern.exactComposite, true)
  assert.equal(ukAudit.jewishModern.effectiveVerseProvenance['uk-varda-torah'], 5846)
  assert.equal(ukAudit.jewishModern.effectiveVerseProvenance['uk-turkonjak-utt'], 17145)
  assert.equal(ukAudit.jewishModern.effectiveVerseProvenance['uk-ohienko-1962'], 215)
})

test('Batch 24 Siddur coverage report matches the actual language bundles', () => {
  for (const [lang, bundle] of Object.entries(siddurBundles)) {
    for (const edition of ['ashkenaz', 'edot']) {
      assert.equal(countTranslated(bundle, edition), coverageAudit.after[lang][edition], `${lang}/${edition}`)
    }
  }
  assert.deepEqual(coverageAudit.after, {
    en: { ashkenaz: 1704, edot: 920 },
    ru: { ashkenaz: 3689, edot: 666 },
    uk: { ashkenaz: 1068, edot: 532 },
  })
})

test('Batch 24 safe fill pass is idempotent and does not contain punctuation-only translations', () => {
  for (const editions of Object.values(coverageAudit.filled)) {
    for (const stats of Object.values(editions)) assert.equal(stats.total, 0)
  }
  for (const bundle of Object.values(siddurBundles)) {
    for (const corpus of Object.values(bundle.corpora ?? {})) {
      for (const section of Object.values(corpus.sections ?? {})) {
        for (const entry of section?.paragraphs ?? []) {
          const text = typeof entry === 'string' ? entry : entry?.text
          if (typeof text !== 'string' || !text.trim()) continue
          assert.match(text, /[\p{L}\p{N}\p{Script=Hebrew}]/u)
        }
      }
    }
  }
})

test('Batch 24 transliteration review is idempotent and records unresolved material instead of guessing', () => {
  assert.equal(translitAudit.newExactContextCorrections, 0)
  assert.ok(translitAudit.contextCorrections >= 264)
  assert.ok(translitAudit.wordCorrections >= 1400)
  assert.ok(translitAudit.siddurPrayerAudit.ashkenaz.paragraphsWithUnresolved > 0)
  assert.ok(translitAudit.siddurPrayerAudit.edot.paragraphsWithUnresolved > 0)
})
