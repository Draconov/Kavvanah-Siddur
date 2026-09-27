#!/usr/bin/env python3
"""Conservative OCR-proofreading cleanup for the supplied Varda Torah corpus.

This pass only repairs high-confidence OCR/layout artefacts. It intentionally does
not modernize, paraphrase, or otherwise rewrite the publisher's Ukrainian text.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "public/texts/translations/tanakh/uk-varda-torah.json"
COMPOSITE = ROOT / "public/texts/translations/tanakh/uk-jewish-modern.json"

CYR = "А-Яа-яІіЇїЄєҐґ"
LATIN_TO_CYR = str.maketrans({
    "A":"А", "B":"В", "C":"С", "E":"Е", "H":"Н", "I":"І", "K":"К",
    "M":"М", "O":"О", "P":"Р", "T":"Т", "X":"Х", "Y":"У",
    "a":"а", "c":"с", "e":"е", "i":"і", "o":"о", "p":"р", "x":"х", "y":"у",
})

EXACT_TOKEN_FIXES = {
    "Тосподь": "Господь",
    "Псаак": "Ісаак",
    "Їсаак": "Ісаак",
    "Псав": "Ісав",
    "Туда": "Юда",
    "Пзраїль": "Ізраїль",
    "Дарон": "Аарон",
    "Мойceю": "Мойсею",
    "Мойceя": "Мойсея",
    "Цуpa": "Цура",
    "Oxpaна": "Охрана",
}

PHRASE_FIXES = {
    "71171);": "יהוה;",
    "71171)": "יהוה",
    "I3раїля": "Ізраїля",
    "I3раїль": "Ізраїль",
    "3емлю": "Землю",
    "3емлі": "Землі",
    "[3a ": "[за ",
    "неможу": "не можу",
    "Осья": "Ось я",
    "інавів": "і навів",
    "ізвірі": "і звірі",
    "внамет": "в намет",
    "нідо,ні": "ні до, ні",
    "їіз нами": "із нами",
    "землюі": "землю і",
    "івін": "і він",
    "їзнову": "знову",
}

# A handful of unmistakable merged OCR fragments seen in the source layer.
REGEX_FIXES = [
    (re.compile(r"\bБукв-\s*«"), "Букв.: «"),
    (re.compile(r"\bНаївр\.?\s*"), "На івр. "),
    (re.compile(r"\bНаїівр\.?\s*"), "На івр. "),
]

VERSE_OVERRIDES = {
    ("genesis", 16, 1): "Сарай, Аврамова жінка, не народжувала йому. Вона мала рабиню Єгиптянку, на ім'я Агар. І сказала Сарай до Аврама:",
    ("genesis", 21, 1): "Як обіцяв, Господь згадав про Сару; і зробив Господь Сарі, як говорив.",
    ("genesis", 21, 2): "Сара зачала й народила сина Авраамові в старості його, у призначений час, про який Бог йому говорив.",
    ("genesis", 29, 35): "Вона ще раз зачала і, народивши сина, сказала: «Тепер я хвалитиму Господа». Тому вона дала йому ім'я Іуда. Потім вона перестала народжувати.",
    ("genesis", 43, 34): "Він посилав їм частини страв зі свого стола, і частина Веніаміна була в п'ять разів більша за частини всіх інших. І вони бенкетували і пили вони з ним.",
    ("exodus", 39, 43): "Мойсей оглянув усі роботи — вони зробили їх, як повелів Господь, так і зробили. І Мойсей благословив їх.",
    ("leviticus", 6, 23): "Але ніщо від очисної жертви, кров якої було внесено в Шатро Зустрічі для очищення [приладдя] Святилища, їсти не можна; вона має бути спалена у вогні.",
    ("leviticus", 11, 2): "— Так скажіть синам Ізраїля: «Ось тварини, яких ви можете їсти з усієї худоби, що на землі:",
    ("leviticus", 15, 33): "робить його нечистим, і про ту, в якої місячні, і про всякого, що має витікання, чоловіка чи жінку, і про чоловіка, який ляже з нечистою [жінкою]».",
    ("leviticus", 26, 46): "Ці закони, настановлення й тори є [умовами Договору], який Господь ухвалив між Собою та народом Ізраїля на горі Сінай, через Мойсея.",
    ("leviticus", 27, 29): "Жодну закляту людину не можна викупити: її треба віддати на смерть.",
    ("numbers", 7, 1): "Того дня, коли Мойсей перестав будувати Скинію, він помазав її та освятив її; він помазав і освятив також усі приладдя її, і жертовник і всі речі його.",
    ("numbers", 7, 9): "Кегатитам, проте, він нічого не дав, бо доручену їм ношу — [речі] Святая Святих — вони мали переносити на плечах.",
    ("numbers", 7, 10): "І коли [Мойсей] помазав жертовник, вожді принесли жертви для його освячення.",
    ("numbers", 7, 19): "Він подав від себе в жертву: одне срібне блюдо вагою сто тридцять шекелів, одну срібну чашу в сімдесят шекелів, шекелів святилищних, наповнені найкращим борошном, змішаним з оливою, на хлібне приношення,",
    ("numbers", 7, 23): "на жертву за добробут двох биків, п'ять баранів, п'ять козлів, п'ять однорічних ягнят. Це — жертва Нетаніеля, сина Цуара.",
    ("numbers", 7, 24): "Третього дня — вождь Зевулунітів Еліав, син Хелона.",
    ("numbers", 7, 31): "Його жертва: одне срібне блюдо вагою сто тридцять шекелів, одна срібна чаша у сімдесят шекелів, шекелів святилищних, наповнені кращим борошном, змішаним з оливою, на хлібне приношення,",
    ("numbers", 7, 66): "Десятого дня — вождь Данітів Ахієзер, син Аммішаддая.",
    ("numbers", 7, 78): "Дванадцятого дня — вождь Нафталітів Ахіра, син Енана.",
    ("numbers", 7, 82): "один козел на очисну жертву,",
    ("numbers", 7, 84): "Ось жертви від Ізраїлевих вождів для освячення жертовника за помазанням його: дванадцять срібних блюд, дванадцять срібних чаш, дванадцять золотих кадильниць.",
    ("numbers", 7, 89): "І коли Мойсей входив до Шатра Зустрічі, щоб говорити з Ним, він чув голос, що звертався до нього з капорета, що над Ковчегом Свідоцтва, (із простору) між двома херувимами; це Він звертався до нього.",
    ("numbers", 18, 32): "Ви не будете покарані [за непринесення десятини], якщо ви вже відклали вбік краще; але більше не торкайтеся святинь цих, принесених Ізраїльтянами, бо помрете».",
    ("numbers", 29, 6): "понад новомісячне всеспалення з його хлібним приношенням і понад регулярне всеспалення з його хлібним приношенням, кожне зі своїм виливом, як наказано, — запашний дар їжі, приємний Господу.",
    ("numbers", 29, 8): "і приносьте всеспалення на пахощі, приємні для Господа: одного бичка, одного барана, сім однорічних ягнят; без пороку нехай вони будуть у вас;",
    ("numbers", 29, 20): "Третього дня: одинадцять бичків, двох баранів, чотирнадцять однорічних ягнят, без пороку;",
    ("numbers", 29, 27): "П'ятого дня: дев'ять бичків, двох баранів, чотирнадцять однорічних ягнят, без пороку, і з ними хлібне приношення та поливання для бичків,",
    ("numbers", 29, 30): "вісім бичків, двох баранів, чотирнадцять однорічних ягнят, без пороку, і з ними хлібне приношення та поливання для бичків, баранів та ягнят, у",
    ("numbers", 29, 33): "сім бичків, двох баранів, чотирнадцять однорічних ягнят, без пороку; і з ними хлібне приношення та поливання для бичків, баранів та ягнят, у настановленій кількості;",
    ("deuteronomy", 2, 1): "ми піднялися і вирушили похідним порядком у пустелю до Червоного моря, як сказав мені Господь, і довгий час ходили навколо нагір'я Сеїр.",
    ("deuteronomy", 16, 1): "Святкуй місяць Авів, приносячи пасхальну жертву Господеві, твоєму Богу; бо в місяці Авіві вивів тебе Господь, твій Бог, із Єгипту вночі. Принеси пасхальну жертву Господеві, твоєму Богу,",
    ("deuteronomy", 19, 21): "життя за життя, око за око, зуб за зуб, руку за руку, ногу за ногу.",
    ("deuteronomy", 26, 19): "і що Він поставить тебе вище за всі народи, які Він створив, відомий славою та почестями, що ти будеш, як Він обіцяв, святим народом у Господа, твого Бога.",
    ("deuteronomy", 32, 3): "Я проголошую Ім'я יהוה; Воздайте ж славу Богу нашому!",
}



def _replace_homoglyphs(token: str) -> str:
    if not re.search(f"[{CYR}]", token):
        # Standalone Latin I is a common OCR substitution for Ukrainian І.
        return "І" if token == "I" else token
    return token.translate(LATIN_TO_CYR)


def _normalise_editorial_brackets(s: str) -> str:
    # OCR often recognizes the book's square brackets as vertical bars or
    # mismatched round/square brackets. Repair only short inline spans.
    for _ in range(3):
        before = s
        s = re.sub(r"\|\s*([^|\n]{1,120}?)\s*\|", lambda m: "[" + m.group(1).strip() + "]", s)
        s = re.sub(r"\|\s*([^|()\[\]\n]{1,100}?)\s*\)", lambda m: "[" + m.group(1).strip() + "]", s)
        s = re.sub(r"\(\s*([^|()\[\]\n]{1,100}?)\s*\|", lambda m: "[" + m.group(1).strip() + "]", s)
        s = re.sub(r"\[\s*([^\[\]()\n]{1,100}?)\s*\)", lambda m: "[" + m.group(1).strip() + "]", s)
        s = re.sub(r"\(\s*([^\[\]()\n]{1,100}?)\s*\]", lambda m: "[" + m.group(1).strip() + "]", s)
        if s == before:
            break
    return s


def _build_vocab(texts: list[str]) -> Counter[str]:
    vocab: Counter[str] = Counter()
    for s in texts:
        # Cheap normalization just for vocabulary lookup.
        s = re.sub(r"[0-9|¦\"“”„]", " ", s)
        for tok in re.findall(f"[{CYR}]+(?:-[{CYR}]+)?", s):
            vocab[tok.lower()] += 1
    return vocab


def _repair_spaced_hyphenation(s: str, vocab: Counter[str]) -> str:
    pat = re.compile(f"\\b([{CYR}]{{2,}})-\\s+([{CYR}]{{2,}})\\b")
    def repl(m: re.Match[str]) -> str:
        a, b = m.group(1), m.group(2)
        joined = (a + b).lower()
        hyph = (a + "-" + b).lower()
        # If the joined form is attested elsewhere, it is overwhelmingly likely
        # to be a line-wrap hyphen introduced by extraction.
        if vocab[joined] >= vocab[hyph] and vocab[joined] > 0:
            return a + b
        # Proper-name compounds and genuine hyphenated forms keep the hyphen,
        # but lose the spurious extraction space.
        return a + "-" + b
    return pat.sub(repl, s)


def clean_text(s: str, vocab: Counter[str]) -> str:
    for a, b in PHRASE_FIXES.items():
        s = s.replace(a, b)

    # Repair mixed Latin/Cyrillic OCR inside words before deleting verse-number noise.
    s = re.sub(r"\S+", lambda m: _replace_homoglyphs(m.group(0)), s)

    # Hebrew divine name on DEU 32:3 was OCR'd entirely as digits.
    s = s.replace("71171", "יהוה")

    # Superscript verse numbers leaked into prose throughout the OCR. Scripture
    # numbers are stored structurally already, so Arabic digits in this text layer
    # are extraction noise rather than content.
    s = re.sub(r"\[?\d+[aA]?\]?", "", s)

    # ASCII/curly quote glyphs are OCR substitutions for verse superscripts in this
    # edition. Real quotation marks in the source are guillemets (« »).
    s = s.replace('"', '').replace('“', '').replace('”', '').replace('„', '')

    s = _normalise_editorial_brackets(s)

    # Remove isolated OCR bars left after bracket reconstruction.
    s = re.sub(r"(?<!\w)\|(?=\s|$)", "", s)
    s = re.sub(r"(?<=\s)\|(?=\w)", "[", s)
    s = re.sub(r"(?<=\w)\|(?=\s|[,.!?:;])", "]", s)

    # Normalize mixed-script tokens again after bracket work.
    s = re.sub(r"\S+", lambda m: _replace_homoglyphs(m.group(0)), s)

    for a, b in EXACT_TOKEN_FIXES.items():
        s = re.sub(rf"\b{re.escape(a)}\b", b, s)
    for pat, repl in REGEX_FIXES:
        s = pat.sub(repl, s)

    s = _repair_spaced_hyphenation(s, vocab)

    # OCR uses doubled hyphens for the edition's em dash.
    s = re.sub(r"\s*-{2,3}\s*", " — ", s)

    # Common leaked verse-marker punctuation at the beginning of a verse.
    s = re.sub(r"^[\s'`?*/\\]+", "", s)
    s = re.sub(r"^[-–—]\s*([«(\[]?)\s*", lambda m: ("— " + m.group(1)) if m.group(1) else "— ", s)

    # Stray single-letter OCR markers immediately glued to a capitalized word.
    # Limit this to known shapes produced by superscript verse numbers.
    s = re.sub(r"^(?:З|Ї|У|Ф|МІ|ЗІ|Зб|ЗП|Г)(?=[А-ЯІЇЄҐ])", "", s)

    # High-confidence leaked superscript markers at verse starts.
    start_fixes = {
        "бколи": "коли", "бпо": "по", "бпояс": "пояс", "ба ": "а ",
        "зеНе": "Не", "зне ": "не ", "зіНе": "Не", "зщоб": "щоб",
        "чОсь": "Ось", "ТЇ ": "І ", "І? ": "І ", "мОсь": "Ось",
        "Ї ще": "І ще", "Гільки": "Тільки", "Ізолото": "золото",
    }
    for a, b in start_fixes.items():
        if s.startswith(a):
            s = b + s[len(a):]
            break
    s = re.sub(r"^[МП](?=[А-ЯІЇЄҐ])", "", s)

    # Spacing around reconstructed brackets and punctuation.
    s = re.sub(r"\[\s+", "[", s)
    s = re.sub(r"\s+\]", "]", s)
    s = re.sub(r"\](?=[{0}])".format(CYR), "] ", s)
    s = re.sub(r"(?<=[{0}])\[".format(CYR), " [", s)
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    s = re.sub(r"([,.;:!?])(?![\s»\]\)])(?=[{0}])".format(CYR), r"\1 ", s)
    s = re.sub(r"\s+", " ", s).strip()

    # Small set of fused words made unambiguous by context-independent spelling.
    for a, b in PHRASE_FIXES.items():
        s = s.replace(a, b)
    return s



# Manually verified against the supplied page images/text layer during the
# proofreading pass. These repair verse-boundary spill and malformed editorial
# brackets that cannot be recovered safely with a generic OCR rule.
VERSE_OVERRIDES.update({
    ("genesis", 7, 2): "усякої чистої худоби візьми по сім [пар], самця та самку, а з нечистої худоби по парі, самця та самку;",
    ("genesis", 11, 9): "Цьому [місту] дано було наймення Вавилон, бо там Господь змішав мову всієї землі; це звідти Господь розпорошив [людей] по всьому світу.",
    ("genesis", 18, 8): "І взяв [Авраам] кисле молоко, свіже молоко та приготоване м'ясо, і поставив перед ними все це; і, поки вони їли, він стояв біля них під деревом.",
    ("genesis", 18, 10): "І сказав [один із них]: — Я повернуся до тебе наступної весни, і буде у Сари, твоєї дружини, син. Сара ж прислухалася [до розмови, стоячи] біля входу до намету, що був поза ним.",
    ("genesis", 19, 17): "Коли вони вивели їх за [місто], то [один із них] сказав: — Рятуйся втечею! Назад не озирайся і не зупиняйся в долині; тікай у гори, щоб не загинути тобі.",
    ("genesis", 19, 21): "І сказав йому [ангел]: — Добре, і в цьому зроблю тобі милість: не винищу міста, про яке ти говориш;",
    ("genesis", 24, 65): "— Хто цей чоловік, що йде полем назустріч нам? — Це мій пан, — сказав слуга. [Ревекка] взяла покривало та",
    ("genesis", 26, 30): "І влаштував [Ісаак] для них бенкет, і вони їли й пили.",
    ("genesis", 27, 2): "— відповів той. — Я постарів, — сказав [Ісаак], — не знаю дня моєї смерті.",
    ("genesis", 27, 14): "Він пішов, взяв [козенят] і приніс їх своїй матері; і зварила його мати страву, яку любив його батько.",
    ("genesis", 27, 36): "І сказав [Ісав]: — Чи не тому було дано йому ім'я Яків, що він уже двічі обманув мене? Спочатку він відібрав у мене первородство, а тепер — моє благословення. І він сказав:",
    ("genesis", 29, 7): "сказав [Яків]: — Сонце ще високо; чи не рано худобу збирати? Напоїли",
    ("genesis", 30, 29): "І сказав йому [Яків]: — Ти знаєш, як я служив тобі і якою стала худоба твоя при мені.",
    ("genesis", 30, 30): "Мало було в тебе до мене, а стало багато. Господь благословив тебе з моїм приходом; настав час, проте, подбати мені про мій дім. І запитав [Лаван] у нього:",
    ("genesis", 35, 14): "І поставив Яків пам'ятник на місці, на якому з ним говорив [Бог], пам'ятник кам'яний, і вилив на нього [вино], і вилив на нього єлей.",
    ("genesis", 36, 9): "Ось нащадки Ісава в нагір'ї Сеїр; [Ісав] — предок Ідумеїв.",
    ("genesis", 37, 21): "Почувши це, Реувен намагався врятувати його від них. — Не вбивайте його! — сказав [Реувен] їм.",
    ("genesis", 39, 4): "то почав виявляти прихильність до Йосипа. [Йосип добре] служив [Потіфару], і той призначив його управителем свого дому, і передав у його розпорядження все, чим володів.",
    ("genesis", 44, 1): "наказав [Йосип] управителю свого дому: — Наповни мішки чоловіків цих їжею, скільки вони можуть донести, і поклади гроші кожного в мішок його.",
    ("genesis", 45, 26): "сказали йому: — Живий Йосип! Він править тепер всією Єгипетською землею! І завмерло серце [Якова]: він не міг повірити їм.",
    ("genesis", 48, 5): "Відтепер два сини твої, що народилися в тебе в Єгипетській землі, до мого прибуття до тебе в Єгипет, будуть [вважатися] моїми; Єфраїм та Менаше будуть мої, як Реувен та Сімеон.",
    ("genesis", 48, 6): "Але діти твої, що народяться від тебе після них, будуть твоїми; наділи їхні будуть частиною наділів [Менаше та Єфраїма], братів їхніх.",
    ("exodus", 1, 14): "вони змушували їх робити; безжалисно перетворювали вони життя їхнє на гіркоту тяжкою працею над глиною та цеглою, і всякими польовими роботами.",
    ("exodus", 1, 15): "Не вдовольняючись цим, цар Єгипетський сказав повитухам, [що приймали пологи у] Єврейок, із яких ім'я однієї було Шіфра, а іншої — Пуа:",
    ("exodus", 21, 1): "— Ось настанови, — сказав Бог Мойсею, — які ти оголосиш їм:",
    ("leviticus", 9, 17): "настановлено. Він підніс до [жертовника] хлібне приношення, відклавши жменю від нього вбік, спалив його на жертовнику разом із ранковим усеспаленням.",
    ("leviticus", 9, 19): "піднесли вони жир із бичка із барана — курдюк та [жир, що покриває нутрощі], нирки та сальники печінки,",
    ("leviticus", 13, 3): "Священник огляне виразку на шкірі тіла цієї людини; якщо волосся на виразці побіліло або виразка виглядає заглибленою в шкіру тіла його, то це виразка прокази; священник, оглянувши його, оголосить його нечистим.",
    ("numbers", 1, 51): "піднімати її, і коли треба буде ставити Скинію, Левіти будуть ставити її; а сторонній, що проникнув [у Святилище], нехай буде страчений.",
    ("numbers", 2, 5): "Поруч із ним: [табор] коліна Іссахара. Вождь Іссахара: Нетаніель, син Цуара. Воїнів його, перелічених у нього:",
    ("numbers", 2, 20): "Табор напівколіна Менаше. Вождь Менаше: Гамліель, син Педацура. Воїнів його, перелічених у нього:",
    ("numbers", 17, 10): "— Відійди від цього товариства, Я їх вигублю вмить. І впали вони ниць, і",
    ("numbers", 35, 10): "Звернися до Ізраїлевого народу і скажи до них: — Коли перейдете через Йордан у",
    ("deuteronomy", 19, 5): "Піде, [наприклад,] хтось із ближнім своїм у ліс рубати дрова і розмахнеться сокирою, щоб зрубати дерево, і зіскочить залізо з сокирища, і потрапить на ближнього, і той помре. [У такому разі] нехай [убивця] втече в одне з тих міст і залишиться живим.",
    ("deuteronomy", 30, 10): "— бо ти будеш слухати слова Господа, Бога твого, дотримуючись заповідей Його та настанов Його, написаних у сувої Вчення цього, коли звернешся до Господа, твого Бога, усім твоїм серцем і всією душею твоєю.",
})

def main() -> int:
    data = json.loads(CORPUS.read_text(encoding="utf-8"))
    records = [v for book in data["books"].values() for ch in book["chapters"] for v in ch]
    vocab = _build_vocab([v["text"] for v in records])

    changed = 0
    for book_id, book in data["books"].items():
        for chapter_no, ch in enumerate(book["chapters"], 1):
            for verse_no, v in enumerate(ch, 1):
                old = v["text"]
                new = clean_text(old, vocab)
                new = VERSE_OVERRIDES.get((book_id, chapter_no, verse_no), new)
                if new != old:
                    v["text"] = new
                    changed += 1

    CORPUS.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    # The selectable "Jewish modern" edition embeds the same five Varda Torah
    # books. Keep that composite byte-for-byte in sync for Torah without touching
    # its Turkonjak Nevi'im/Ketuvim books.
    composite = json.loads(COMPOSITE.read_text(encoding="utf-8"))
    for book_id in data["books"]:
        composite["books"][book_id] = data["books"][book_id]
    COMPOSITE.write_text(json.dumps(composite, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    print(f"proofread {changed}/{len(records)} Varda Torah verse records; synchronized Jewish modern Torah")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
