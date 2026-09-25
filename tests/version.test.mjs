import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const text=name=>readFileSync(new URL(name,root),'utf8');
const json=name=>JSON.parse(text(name));

test('VERSION is the single release version source',()=>{
 const release=text('VERSION').trim();
 assert.match(release,/^\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?$/);
 const [numeric,suffix='']=release.split('-',2),parts=numeric.split('.');while(parts.length<3)parts.push('0');
 const semver=parts.join('.')+(suffix?`-${suffix}`:'');
 assert.equal(json('package.json').version,semver);
 assert.equal(json('packaging/android/package.json').version,semver);
 assert.equal(json('src-tauri/tauri.conf.json').version,semver);
 assert.match(text('src-tauri/Cargo.toml'),new RegExp(`^version = "${semver.replaceAll('.','\\.')}"$`,'m'));
});

test('same VERSION replaces the existing normal GitHub release',()=>{
 const workflow=text('.github/workflows/pages.yml');
 assert.match(workflow,/TAG=v\$VERSION/);
 assert.match(workflow,/gh release delete "\$TAG" --yes/);
 assert.match(workflow,/git push origin "refs\/tags\/\$TAG" --force/);
 assert.match(workflow,/gh release create "\$TAG" release\/\*/);
 assert.match(workflow,/assembleRelease/);
 assert.match(workflow,/Kavvanah-Android-universal\.apk/);
 assert.doesNotMatch(workflow,/assembleDebug|app-debug|universal-debug|--prerelease|development build|development release/i);
});
