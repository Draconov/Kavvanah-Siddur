/** Transliteration for calendrical proper names, not translations of Scripture. */
export const parashaNames:Record<string,readonly [string,string]> = {
 Bereshit:['Берешит','Берешіт'],Noach:['Ноах','Ноах'],LechLecha:['Лех-Леха','Лех-Леха'],Vayera:['Вайера','Вайєра'],ChayeiSara:['Хаей Сара','Хаєй Сара'],Toldot:['Толдот','Толдот'],Vayetzei:['Вайеце','Вайєце'],Vayishlach:['Вайишлах','Вайішлах'],Vayeshev:['Вайешев','Вайєшев'],Miketz:['Микец','Мікец'],Vayigash:['Вайигаш','Вайіґаш'],Vayechi:['Вайехи','Вайєхі'],
 Shemot:['Шмот','Шмот'],Vaera:['Ваэра','Ваєра'],Bo:['Бо','Бо'],Beshalach:['Бешалах','Бешалах'],Yitro:['Итро','Їтро'],Mishpatim:['Мишпатим','Мішпатім'],Terumah:['Трума','Трума'],Tetzaveh:['Тецаве','Тецаве'],KiTisa:['Ки Тиса','Кі Тіса'],Vayakhel:['Вайакгель','Вайакгель'],Pekudei:['Пкудей','Пкудей'],
 Vayikra:['Вайикра','Вайікра'],Tzav:['Цав','Цав'],Shmini:['Шмини','Шміні'],Tazria:['Тазриа','Тазріа'],Metzora:['Мецора','Мецора'],AchreiMot:['Ахарей Мот','Ахарей Мот'],Kedoshim:['Кдошим','Кдошім'],Emor:['Эмор','Емор'],Behar:['Бегар','Бегар'],Bechukotai:['Бехукотай','Бехукотай'],
 Bamidbar:['Бемидбар','Бемідбар'],Nasso:['Насо','Насо'],Behaalotcha:['Беаалотха','Беаалотха'],Shlach:['Шлах','Шлах'],Korach:['Корах','Корах'],Chukat:['Хукат','Хукат'],Balak:['Балак','Балак'],Pinchas:['Пинхас','Пінхас'],Matot:['Матот','Матот'],Masei:['Масей','Масей'],
 Devarim:['Дварим','Дварім'],Vaetchanan:['Ваэтханан','Ваетханан'],Eikev:['Экев','Екев'],Reeh:['Реэ','Рее'],Shoftim:['Шофтим','Шофтім'],KiTeitzei:['Ки Теце','Кі Теце'],KiTavo:['Ки Таво','Кі Таво'],Nitzavim:['Ницавим','Ніцавім'],Vayeilech:['Вайелех','Вайєлех'],Haazinu:['Аазину','Гаазіну'],VezotHaberakhah:['Везот ха-Браха','Везот га-Браха'],
};
// Hebcal sometimes spells portion names as spaced, hyphenated, or with apostrophes.
const aliases:Record<string,string>={
 'Naso':'Nasso','Metzora':'Metzora','Vayelech':'Vayeilech','Vayechi':'Vayechi',
 'Lech-Lecha':'LechLecha','Lech Lecha':'LechLecha','Chayei Sara':'ChayeiSara','Ki Tisa':'KiTisa',
 'Achrei Mot':'AchreiMot','Acharei Mot':'AchreiMot','Bechukotai':'Bechukotai','Bechukosai':'Bechukotai',
 'Behaalotecha':'Behaalotcha',"Beha'alotcha":'Behaalotcha','Sh’lach':'Shlach',"Sh'lach":'Shlach',
 'Ki Teitzei':'KiTeitzei','Ki Tetze':'KiTeitzei','Ki Tavo':'KiTavo','Vezot Haberakhah':'VezotHaberakhah',
 'Ekev':'Eikev','Re’eh':'Reeh',"Re'eh":'Reeh',
};
function parasha(language:'ru'|'uk',name:string):string|null {
 const idx=language==='ru'?0:1;
 const canonical=aliases[name]??name;
 const direct=parashaNames[canonical];
 if(direct)return direct[idx];
 // Hebcal combines two portions with a hyphen. Longest names must be matched first.
 const options=[...Object.keys(parashaNames),...Object.keys(aliases)].sort((a,b)=>b.length-a.length);
 for(const first of options){
  if(!name.startsWith(first+'-'))continue;
  const remaining=name.slice(first.length+1);
  const tail=parasha(language,remaining);
  if(tail)return `${parasha(language,first)} — ${tail}`;
 }
 return null;
}
export function calendarLabel(language:'ru'|'uk',key:string):string|null {
 const prefix=key.match(/^(Parashat|Parsha) (.+)$/);
 if(prefix){
  const name=parasha(language,prefix[2]);
  if(name)return `Парашат ${name}`;
 }
 // Match entire name: prefixes may themselves contain multiple words.
 const rosh=key.match(/^(Erev )?Rosh Chodesh (.+)$/);
 if(rosh){
  const month=rosh[2];
  const months:Record<string,readonly [string,string]>={
   Nisan:['Нисан','Нісан'],Iyyar:['Ияр','Іяр'],Sivan:['Сиван','Сіван'],Tamuz:['Таммуз','Таммуз'],Av:['Ав','Ав'],Elul:['Элул','Елул'],Tishrei:['Тишрей','Тішрей'],Cheshvan:['Хешван','Хешван'],Kislev:['Кислев','Кіслев'],Tevet:['Тевет','Тевет'],Shvat:['Шват','Шват'],
   "Sh'vat":['Шват','Шват'],"Sh’vat":['Шват','Шват'],Adar:['Адар','Адар'],'Adar I':['Адар I','Адар I'],'Adar II':['Адар II','Адар II'],
  };
  const localized=months[month]?.[language==='ru'?0:1]??month;
  return (rosh[1]?(language==='ru'?'Канун ':'Переддень '):'')+'Рош-ходеш '+localized;
 }
 const hanukkah=key.match(/^(Chanukah|Hanukkah): (\d+) Candles?$/);
 if(hanukkah)return (language==='ru'?`Ханука: ${hanukkah[2]} свечей`:`Ханука: ${hanukkah[2]} свічок`);

 return null;
}
