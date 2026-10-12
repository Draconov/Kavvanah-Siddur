/**
 * Build-only reading assets. Keep the canonical text bundles intact for source
 * attribution, translators, import tools and full-corpus integrity tests.
 * The installed/hosted app downloads only the current nusach or Tanakh book.
 */
import { readFile, readdir, mkdir, rm, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = path.resolve(root, process.argv[2] ?? 'public/texts/translations');
const output = path.resolve(root, process.argv[3] ?? 'public/texts/translations/optimized');
if (output === source || !output.startsWith(source + path.sep)) {
  throw Error('Reader asset output must be a dedicated subfolder of the translations source');
}
const staging = `${output}.staging`;
const load = async file => JSON.parse(await readFile(file, 'utf8'));
const write = async (file, value) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
};
await rm(staging, { recursive: true, force: true });
let siddurCount = 0, tanakhCount = 0, chapterCount = 0;
try {
for (const lang of ['en', 'ru', 'uk']) {
  const corpus = await load(path.join(source, `${lang}.json`));
  if (corpus.schema !== 1 || corpus.language !== lang) throw Error(`Invalid Siddur source: ${lang}`);
  for (const nusach of ['ashkenaz', 'edot']) {
    if (!corpus.corpora?.[nusach]) throw Error(`Missing ${lang}/${nusach} Siddur corpus`);
    await write(path.join(staging, 'siddur', `${lang}-${nusach}.json`), {
      schema: corpus.schema, language: corpus.language, corpora: { [nusach]: corpus.corpora[nusach] },
    });
    siddurCount++;
  }
}
const directory = path.join(source, 'tanakh');
for (const file of (await readdir(directory)).filter(f => f.endsWith('.json')).sort()) {
  const bundle = await load(path.join(directory, file));
  if (bundle.schema !== 1 || !bundle.edition || !bundle.language || !bundle.books) throw Error(`Invalid Tanakh source: ${file}`);
  // The Jewish Modern preset resolves to Varda (Torah) and Turkonjak (all other books).
  // Its combined JSON is needed for audits, but never downloaded by the reader.
  if (!/^[a-z0-9-]+$/.test(bundle.edition)) throw Error(`Invalid Tanakh edition path: ${file}`);
  if (bundle.edition !== file.slice(0, -5)) throw Error(`Tanakh edition does not match filename: ${file}`);
  if (bundle.edition === 'uk-jewish-modern') continue;
  for (const [bookId, book] of Object.entries(bundle.books)) {
    if (!/^[a-z-]+$/.test(bookId) || !Array.isArray(book.chapters)) throw Error(`Invalid Tanakh book: ${file}/${bookId}`);
    tanakhCount++;
    for(let i=0;i<book.chapters.length;i++){
      if(!Array.isArray(book.chapters[i]))throw Error(`Invalid Tanakh chapter: ${file}/${bookId}:${i+1}`);
      await write(path.join(staging, 'tanakh-chapters', bundle.edition, bookId, `${i+1}.json`), {
        schema: bundle.schema, language: bundle.language, edition: bundle.edition,
        sources: bundle.sources, books: { [bookId]: { chapters: [book.chapters[i]] } },
      });
      chapterCount++;
    }
  }
}
  // Only replace the previous generated assets after *all* source files parsed.
  // A failed import must not leave a half-generated reader library behind.
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
  console.log(`Reader assets: ${siddurCount} Siddur corpora and ${tanakhCount} Tanakh books / ${chapterCount} chapters (canonical sources unchanged)`);
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}
