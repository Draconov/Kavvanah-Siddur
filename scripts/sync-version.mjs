import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const raw=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
if(!/^\d+\.\d+\.\d+$/.test(raw))throw new Error(`Invalid VERSION: ${raw}. Expected MAJOR.MINOR.PATCH, for example 1.0.0`);
const parts=raw.split('.').map(Number);
const semver=raw;
const versionCode=parts[0]*1_000_000+parts[1]*1_000+parts[2];
if(parts[1]>999||parts[2]>999||versionCode<1||versionCode>2_100_000_000)throw new Error(`VERSION ${raw} cannot be represented safely as an Android versionCode`);

async function updateJson(relative){
 const file=path.join(root,relative),data=JSON.parse(await readFile(file,'utf8'));
 data.version=semver;
 await writeFile(file,JSON.stringify(data,null,2)+'\n');
}
await updateJson('package.json');
await updateJson('packaging/android/package.json');
await updateJson('src-tauri/tauri.conf.json');

const cargoPath=path.join(root,'src-tauri/Cargo.toml');
let cargo=await readFile(cargoPath,'utf8');
cargo=cargo.replace(/^(version\s*=\s*)"[^"]+"/m,`$1"${semver}"`);
await writeFile(cargoPath,cargo);

const gradleFlag=process.argv.indexOf('--android-gradle');
if(gradleFlag>=0){
 const relative=process.argv[gradleFlag+1];
 if(!relative)throw new Error('--android-gradle requires a path');
 const gradlePath=path.resolve(root,relative);
 let gradle=await readFile(gradlePath,'utf8');
 gradle=gradle.replace(/versionCode\s+\d+/,`versionCode ${versionCode}`);
 gradle=gradle.replace(/versionName\s+"[^"]+"/,`versionName "${semver}"`);
 await writeFile(gradlePath,gradle);
}
console.log(`Kavvanah version ${semver} (source: VERSION)`);
