// ================================
// Course Data: Alphabet Bridge
// ================================

import { Course, Question } from '@/types';

type StudyModeTag = 'typing' | 'choice';
type TypingLevel = 1 | 2 | 3;
type ChoiceLevel = 1 | 2 | 3 | 4;

type Seed = {
    promptJp: string;
    answerEn: string;
    targetMode: StudyModeTag;
    targetLevel: number;
};

type SectionDef = {
    id: string;
    type: string;
    label: string;
    uppers: string[];
    typingRounds?: Partial<Record<TypingLevel, number>>;
    choiceRounds?: Partial<Record<ChoiceLevel, number>>;
    typingOffset?: number;
    choiceOffset?: number;
};

type PartDef = {
    id: string;
    label: string;
    pos: string;
    category: string[];
    sections: SectionDef[];
};

type UnitDef = {
    id: string;
    name: string;
    parts: PartDef[];
};

type LetterCard = {
    upper: string;
    lower: string;
    nameJp: string;
    keywordEn: string;
    keywordJp: string;
};

const courseName = 'Alphabet Bridge';

const cards: LetterCard[] = [
    { upper: 'A', lower: 'a', nameJp: 'エー', keywordEn: 'apple', keywordJp: 'りんご' },
    { upper: 'B', lower: 'b', nameJp: 'ビー', keywordEn: 'book', keywordJp: 'ほん' },
    { upper: 'C', lower: 'c', nameJp: 'シー', keywordEn: 'cat', keywordJp: 'ねこ' },
    { upper: 'D', lower: 'd', nameJp: 'ディー', keywordEn: 'dog', keywordJp: 'いぬ' },
    { upper: 'E', lower: 'e', nameJp: 'イー', keywordEn: 'egg', keywordJp: 'たまご' },
    { upper: 'F', lower: 'f', nameJp: 'エフ', keywordEn: 'fish', keywordJp: 'さかな' },
    { upper: 'G', lower: 'g', nameJp: 'ジー', keywordEn: 'grape', keywordJp: 'ぶどう' },
    { upper: 'H', lower: 'h', nameJp: 'エイチ', keywordEn: 'hat', keywordJp: 'ぼうし' },
    { upper: 'I', lower: 'i', nameJp: 'アイ', keywordEn: 'ice', keywordJp: 'こおり' },
    { upper: 'J', lower: 'j', nameJp: 'ジェイ', keywordEn: 'juice', keywordJp: 'ジュース' },
    { upper: 'K', lower: 'k', nameJp: 'ケイ', keywordEn: 'key', keywordJp: 'かぎ' },
    { upper: 'L', lower: 'l', nameJp: 'エル', keywordEn: 'leaf', keywordJp: 'はっぱ' },
    { upper: 'M', lower: 'm', nameJp: 'エム', keywordEn: 'milk', keywordJp: 'ミルク' },
    { upper: 'N', lower: 'n', nameJp: 'エヌ', keywordEn: 'nest', keywordJp: 'す' },
    { upper: 'O', lower: 'o', nameJp: 'オー', keywordEn: 'orange', keywordJp: 'オレンジ' },
    { upper: 'P', lower: 'p', nameJp: 'ピー', keywordEn: 'pen', keywordJp: 'ペン' },
    { upper: 'Q', lower: 'q', nameJp: 'キュー', keywordEn: 'queen', keywordJp: 'おうじょ' },
    { upper: 'R', lower: 'r', nameJp: 'アール', keywordEn: 'robot', keywordJp: 'ロボット' },
    { upper: 'S', lower: 's', nameJp: 'エス', keywordEn: 'sun', keywordJp: 'たいよう' },
    { upper: 'T', lower: 't', nameJp: 'ティー', keywordEn: 'train', keywordJp: 'でんしゃ' },
    { upper: 'U', lower: 'u', nameJp: 'ユー', keywordEn: 'umbrella', keywordJp: 'かさ' },
    { upper: 'V', lower: 'v', nameJp: 'ブイ', keywordEn: 'violin', keywordJp: 'バイオリン' },
    { upper: 'W', lower: 'w', nameJp: 'ダブリュー', keywordEn: 'watch', keywordJp: 'とけい' },
    { upper: 'X', lower: 'x', nameJp: 'エックス', keywordEn: 'xylophone', keywordJp: 'もっきん' },
    { upper: 'Y', lower: 'y', nameJp: 'ワイ', keywordEn: 'yogurt', keywordJp: 'ヨーグルト' },
    { upper: 'Z', lower: 'z', nameJp: 'ゼット', keywordEn: 'zebra', keywordJp: 'しまうま' },
];

const defaultTypingRounds: Record<TypingLevel, number> = {
    1: 2,
    2: 2,
    3: 1,
};

const defaultChoiceRounds: Record<ChoiceLevel, number> = {
    1: 2,
    2: 2,
    3: 1,
    4: 1,
};

const typingTemplates: Record<TypingLevel, Array<(card: LetterCard) => string>> = {
    1: [
        (card) => `【L1】文字名「${card.nameJp}」の小文字を入力`,
        (card) => `【L1】${card.keywordJp} の頭文字（小文字）を入力`,
    ],
    2: [
        (card) => `【L2】文字名「${card.nameJp}」の大文字を入力`,
        (card) => `【L2】${card.keywordEn} の頭文字（大文字）を入力`,
    ],
    3: [
        (card) => `【L3】${card.keywordEn} の文字セット（大→小）を入力`,
        (card) => `【L3】${card.keywordJp} の文字セット（大→小）を入力`,
    ],
};

const choiceTemplates: Record<ChoiceLevel, Array<(card: LetterCard) => { promptJp: string; answerEn: string }>> = {
    1: [
        (card) => ({ promptJp: `文字名「${card.nameJp}」`, answerEn: card.upper }),
        (card) => ({ promptJp: `小文字は「${card.lower}」`, answerEn: card.upper }),
    ],
    2: [
        (card) => ({ promptJp: `文字名「${card.nameJp}」の大文字`, answerEn: card.upper }),
        (card) => ({ promptJp: `${card.keywordJp} の頭文字（大文字）`, answerEn: card.upper }),
    ],
    3: [
        (card) => ({ promptJp: `キーワード「${card.keywordJp}」`, answerEn: card.keywordEn }),
        (card) => ({ promptJp: `文字名「${card.nameJp}」の英単語`, answerEn: card.keywordEn }),
    ],
    4: [
        (card) => ({ promptJp: `「${card.keywordJp}」の英語`, answerEn: card.keywordEn }),
        (card) => ({ promptJp: `「${card.nameJp}」のキーワード`, answerEn: card.keywordEn }),
    ],
};

function getCard(upper: string): LetterCard {
    const found = cards.find((item) => item.upper === upper);
    if (!found) {
        throw new Error(`Unknown letter card: ${upper}`);
    }
    return found;
}

function buildTypingAnswer(card: LetterCard, level: TypingLevel): string {
    if (level === 1) return card.lower;
    if (level === 2) return card.upper;
    return `${card.upper}${card.lower}`;
}

function resolveTypingRounds(section: SectionDef, level: TypingLevel): number {
    return section.typingRounds?.[level] ?? defaultTypingRounds[level];
}

function resolveChoiceRounds(section: SectionDef, level: ChoiceLevel): number {
    return section.choiceRounds?.[level] ?? defaultChoiceRounds[level];
}

function buildTypingSeeds(section: SectionDef): Seed[] {
    const selected = section.uppers.map((upper) => getCard(upper));
    const seeds: Seed[] = [];
    const levels: TypingLevel[] = [1, 2, 3];

    levels.forEach((level) => {
        const templates = typingTemplates[level];
        const rounds = resolveTypingRounds(section, level);

        for (let round = 0; round < rounds; round += 1) {
            selected.forEach((card, index) => {
                const templateIndex = ((section.typingOffset ?? 0) + round + index) % templates.length;
                seeds.push({
                    promptJp: templates[templateIndex](card),
                    answerEn: buildTypingAnswer(card, level),
                    targetMode: 'typing',
                    targetLevel: level,
                });
            });
        }
    });

    return seeds;
}

function buildChoiceSeeds(section: SectionDef): Seed[] {
    const selected = section.uppers.map((upper) => getCard(upper));
    const seeds: Seed[] = [];
    const levels: ChoiceLevel[] = [1, 2, 3, 4];

    levels.forEach((level) => {
        const templates = choiceTemplates[level];
        const rounds = resolveChoiceRounds(section, level);

        for (let round = 0; round < rounds; round += 1) {
            selected.forEach((card, index) => {
                const templateIndex = ((section.choiceOffset ?? 0) + round + index) % templates.length;
                const item = templates[templateIndex](card);
                seeds.push({
                    promptJp: item.promptJp,
                    answerEn: item.answerEn,
                    targetMode: 'choice',
                    targetLevel: level,
                });
            });
        }
    });

    return seeds;
}

function buildSectionSeeds(section: SectionDef): Seed[] {
    return [
        ...buildChoiceSeeds(section),
        ...buildTypingSeeds(section),
    ];
}

const units: UnitDef[] = [
    {
        id: 'alpb-unit-1',
        name: 'Unit 1: A-M ペアカード',
        parts: [
            {
                id: 'alpb-unit-1-part-1',
                label: 'A-M 導入',
                pos: 'alphabet-bridge-a-m-core',
                category: ['alphabet', 'bridge', 'duolingo-abc-pattern'],
                sections: [
                    {
                        id: 'alpb-unit-1-part-1-section-1',
                        type: 'alpb-unit-1-part-1-section-1',
                        label: 'A-F',
                        uppers: ['A', 'B', 'C', 'D', 'E', 'F'],
                    },
                    {
                        id: 'alpb-unit-1-part-1-section-2',
                        type: 'alpb-unit-1-part-1-section-2',
                        label: 'G-M',
                        uppers: ['G', 'H', 'I', 'J', 'K', 'L', 'M'],
                        typingOffset: 1,
                        choiceOffset: 1,
                    },
                ],
            },
            {
                id: 'alpb-unit-1-part-2',
                label: 'A-M 定着',
                pos: 'alphabet-bridge-a-m-spiral',
                category: ['alphabet', 'bridge', 'spiral'],
                sections: [
                    {
                        id: 'alpb-unit-1-part-2-section-1',
                        type: 'alpb-unit-1-part-2-section-1',
                        label: 'A-M 反復1',
                        uppers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
                        typingOffset: 2,
                        choiceOffset: 2,
                        typingRounds: { 3: 2 },
                    },
                    {
                        id: 'alpb-unit-1-part-2-section-2',
                        type: 'alpb-unit-1-part-2-section-2',
                        label: 'A-M 反復2',
                        uppers: ['M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'],
                        typingRounds: { 1: 1, 2: 1, 3: 1 },
                        choiceRounds: { 1: 1, 2: 1, 3: 1, 4: 1 },
                    },
                ],
            },
        ],
    },
    {
        id: 'alpb-unit-2',
        name: 'Unit 2: N-Z ペアカード',
        parts: [
            {
                id: 'alpb-unit-2-part-1',
                label: 'N-Z 導入',
                pos: 'alphabet-bridge-n-z-core',
                category: ['alphabet', 'bridge', 'duolingo-abc-pattern'],
                sections: [
                    {
                        id: 'alpb-unit-2-part-1-section-1',
                        type: 'alpb-unit-2-part-1-section-1',
                        label: 'N-T',
                        uppers: ['N', 'O', 'P', 'Q', 'R', 'S', 'T'],
                    },
                    {
                        id: 'alpb-unit-2-part-1-section-2',
                        type: 'alpb-unit-2-part-1-section-2',
                        label: 'U-Z',
                        uppers: ['U', 'V', 'W', 'X', 'Y', 'Z'],
                        typingOffset: 1,
                        choiceOffset: 1,
                    },
                ],
            },
            {
                id: 'alpb-unit-2-part-2',
                label: 'N-Z 定着',
                pos: 'alphabet-bridge-n-z-spiral',
                category: ['alphabet', 'bridge', 'spiral'],
                sections: [
                    {
                        id: 'alpb-unit-2-part-2-section-1',
                        type: 'alpb-unit-2-part-2-section-1',
                        label: 'N-Z 反復1',
                        uppers: ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
                        typingOffset: 2,
                        choiceOffset: 2,
                        typingRounds: { 3: 2 },
                    },
                    {
                        id: 'alpb-unit-2-part-2-section-2',
                        type: 'alpb-unit-2-part-2-section-2',
                        label: 'N-Z 反復2',
                        uppers: ['Z', 'Y', 'X', 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P', 'O', 'N'],
                        typingRounds: { 1: 1, 2: 1, 3: 1 },
                        choiceRounds: { 1: 1, 2: 1, 3: 1, 4: 1 },
                    },
                ],
            },
        ],
    },
    {
        id: 'alpb-unit-3',
        name: 'Unit 3: まぎらわし対策 + 全体復習',
        parts: [
            {
                id: 'alpb-unit-3-part-1',
                label: 'まぎらわし集中',
                pos: 'alphabet-bridge-confusable',
                category: ['alphabet', 'bridge', 'confusable'],
                sections: [
                    {
                        id: 'alpb-unit-3-part-1-section-1',
                        type: 'alpb-unit-3-part-1-section-1',
                        label: 'B/D/P/Q',
                        uppers: ['B', 'D', 'P', 'Q'],
                        typingRounds: { 1: 3, 2: 3, 3: 2 },
                        choiceRounds: { 1: 3, 2: 3, 3: 2, 4: 2 },
                    },
                    {
                        id: 'alpb-unit-3-part-1-section-2',
                        type: 'alpb-unit-3-part-1-section-2',
                        label: 'I/L/J/T',
                        uppers: ['I', 'L', 'J', 'T'],
                        typingRounds: { 1: 3, 2: 3, 3: 2 },
                        choiceRounds: { 1: 3, 2: 3, 3: 2, 4: 2 },
                        typingOffset: 1,
                        choiceOffset: 1,
                    },
                    {
                        id: 'alpb-unit-3-part-1-section-3',
                        type: 'alpb-unit-3-part-1-section-3',
                        label: 'M/N/U/V/W/Y',
                        uppers: ['M', 'N', 'U', 'V', 'W', 'Y'],
                        typingRounds: { 1: 2, 2: 2, 3: 2 },
                        choiceRounds: { 1: 2, 2: 2, 3: 2, 4: 2 },
                        typingOffset: 2,
                        choiceOffset: 2,
                    },
                ],
            },
            {
                id: 'alpb-unit-3-part-2',
                label: '全26スパイラル',
                pos: 'alphabet-bridge-all-letters',
                category: ['alphabet', 'bridge', 'all'],
                sections: [
                    {
                        id: 'alpb-unit-3-part-2-section-1',
                        type: 'alpb-unit-3-part-2-section-1',
                        label: '全26チェック1',
                        uppers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
                        typingRounds: { 1: 1, 2: 1, 3: 1 },
                        choiceRounds: { 1: 1, 2: 1, 3: 1, 4: 1 },
                    },
                    {
                        id: 'alpb-unit-3-part-2-section-2',
                        type: 'alpb-unit-3-part-2-section-2',
                        label: '全26チェック2',
                        uppers: ['Z', 'Y', 'X', 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'],
                        typingRounds: { 1: 1, 2: 1, 3: 1 },
                        choiceRounds: { 1: 1, 2: 1, 3: 1, 4: 1 },
                        typingOffset: 1,
                        choiceOffset: 1,
                    },
                    {
                        id: 'alpb-unit-3-part-2-section-3',
                        type: 'alpb-unit-3-part-2-section-3',
                        label: '総合ミックス',
                        uppers: ['A', 'E', 'I', 'O', 'U', 'B', 'D', 'P', 'Q', 'M', 'N', 'V', 'W', 'X', 'Y', 'Z'],
                        typingRounds: { 1: 2, 2: 2, 3: 2 },
                        choiceRounds: { 1: 2, 2: 2, 3: 2, 4: 2 },
                        typingOffset: 2,
                        choiceOffset: 2,
                    },
                ],
            },
        ],
    },
];

const questions: Question[] = [];
let serial = 1;

const toQuestion = (
    unitName: string,
    partId: string,
    sectionId: string,
    sectionLabel: string,
    pos: string,
    category: string[],
    seed: Seed,
    orderIndex: number,
): Question => ({
    id: `alpb-q${serial++}`,
    course: courseName,
    unit: unitName,
    partId,
    section: sectionId,
    sectionLabel,
    promptJp: seed.promptJp,
    answerEn: seed.answerEn,
    pos: [pos],
    category: [
        ...category,
        seed.targetMode === 'typing' ? 'typing-only' : 'choice-only',
        seed.targetMode === 'typing' ? `typing-l${seed.targetLevel}` : `choice-l${seed.targetLevel}`,
    ],
    orderIndex,
});

units.forEach((unit) => {
    unit.parts.forEach((part) => {
        part.sections.forEach((section) => {
            const seeds = buildSectionSeeds(section);
            seeds.forEach((seed, idx) => {
                questions.push(
                    toQuestion(
                        unit.name,
                        part.id,
                        section.id,
                        section.label,
                        part.pos,
                        part.category,
                        seed,
                        idx + 1,
                    )
                );
            });
        });
    });
});

export { questions };

export const courseStructure: Course = {
    id: 'course-alphabet-bridge',
    name: courseName,
    units: units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        parts: unit.parts.map((part) => ({
            id: part.id,
            label: part.label,
            totalQuestions: part.sections.reduce((sum, section) => sum + buildSectionSeeds(section).length, 0),
            sections: part.sections.map((section) => ({
                id: section.id,
                type: section.type,
                label: section.label,
                questionIds: questions.filter((q) => q.section === section.id).map((q) => q.id),
            })),
        })),
    })),
};
