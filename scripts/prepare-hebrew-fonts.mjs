/** Download the two optional font families for local/offline packaging.
 * Pinned upstream Google Fonts git tree, only locally generated on build.
 * Do not commit binary font assets. Preserve OFL.txt for both families.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
const commit='66928797f271fed5ee428544e7229685e2d90127';
const upstream=`https://raw.githubusercontent.com/google/fonts/${commit}/ofl`;
const targets=[
 ['alef/Alef-Regular.ttf','public/fonts/optional/Alef-Regular.ttf',90996],
 ['alef/Alef-Bold.ttf','public/fonts/optional/Alef-Bold.ttf',92312],
 ['notorashihebrew/NotoRashiHebrew%5Bwght%5D.ttf','public/fonts/optional/NotoRashiHebrew.ttf',109056],
 ['alef/OFL.txt','public/licenses/Alef-OFL.txt',4519],
 ['notorashihebrew/OFL.txt','public/licenses/Noto-Rashi-Hebrew-OFL.txt',4382],
];
for(const [relative,destination,size] of targets){
 try{if((await readFile(destination)).length===size)continue;}catch{}
 const url=`${upstream}/${relative}`;
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`Unable to prepare optional Hebrew font: ${response.status} ${url}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length!==size)throw Error(`Pinned optional font asset changed size: ${relative}`);
 await mkdir(dirname(destination),{recursive:true});
 await writeFile(destination,bytes);
 console.log(`Prepared offline font asset ${join(destination)}`);
}
