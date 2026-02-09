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

// 幼児〜小学生でも扱いやすい語を優先
const cards: LetterCard[] = [
    { upper: 'A', lower: 'a', nameJp: 'エー', keywordEn: 'apple', keywordJp: 'りんご' },
    { upper: 'B', lower: 'b', nameJp: 'ビー', keywordEn: 'ball', keywordJp: 'ボール' },
    { upper: 'C', lower: 'c', nameJp: 'シー', keywordEn: 'cat', keywordJp: 'ねこ' },
    { upper: 'D', lower: 'd', nameJp: 'ディー', keywordEn: 'dog', keywordJp: 'いぬ' },
    { upper: 'E', lower: 'e', nameJp: 'イー', keywordEn: 'egg', keywordJp: 'たまご' },
    { upper: 'F', lower: 'f', nameJp: 'エフ', keywordEn: 'fish', keywordJp: 'さかな' },
    { upper: 'G', lower: 'g', nameJp: 'ジー', keywordEn: 'grape', keywordJp: 'ぶどう' },
    { upper: 'H', lower: 'h', nameJp: 'エイチ', keywordEn: 'hat', keywordJp: 'ぼうし' },
    { upper: 'I', lower: 'i', nameJp: 'アイ', keywordEn: 'ice', keywordJp: 'こおり' },
    { upper: 'J', lower: 'j', nameJp: 'ジェイ', keywordEn: 'jam', keywordJp: 'ジャム' },
    { upper: 'K', lower: 'k', nameJp: 'ケイ', keywordEn: 'key', keywordJp: 'かぎ' },
    { upper: 'L', lower: 'l', nameJp: 'エル', keywordEn: 'lion', keywordJp: 'ライオン' },
    { upper: 'M', lower: 'm', nameJp: 'エム', keywordEn: 'milk', keywordJp: 'ミルク' },
    { upper: 'N', lower: 'n', nameJp: 'エヌ', keywordEn: 'nose', keywordJp: 'はな' },
    { upper: 'O', lower: 'o', nameJp: 'オー', keywordEn: 'orange', keywordJp: 'オレンジ' },
    { upper: 'P', lower: 'p', nameJp: 'ピー', keywordEn: 'pen', keywordJp: 'ペン' },
    { upper: 'Q', lower: 'q', nameJp: 'キュー', keywordEn: 'queen', keywordJp: 'クイーン' },
    { upper: 'R', lower: 'r', nameJp: 'アール', keywordEn: 'rabbit', keywordJp: 'うさぎ' },
    { upper: 'S', lower: 's', nameJp: 'エス', keywordEn: 'sun', keywordJp: 'たいよう' },
    { upper: 'T', lower: 't', nameJp: 'ティー', keywordEn: 'tiger', keywordJp: 'とら' },
    { upper: 'U', lower: 'u', nameJp: 'ユー', keywordEn: 'umbrella', keywordJp: 'かさ' },
    { upper: 'V', lower: 'v', nameJp: 'ブイ', keywordEn: 'van', keywordJp: 'バン' },
    { upper: 'W', lower: 'w', nameJp: 'ダブリュー', keywordEn: 'watch', keywordJp: 'とけい' },
    { upper: 'X', lower: 'x', nameJp: 'エックス', keywordEn: 'xray', keywordJp: 'エックスせん' },
    { upper: 'Y', lower: 'y', nameJp: 'ワイ', keywordEn: 'yoyo', keywordJp: 'ヨーヨー' },
    { upper: 'Z', lower: 'z', nameJp: 'ゼット', keywordEn: 'zebra', keywordJp: 'しまうま' },
];

const defaultTypingRounds: Record<TypingLevel, number> = {
    1: 2,
    2: 1,
    3: 1,
};

const defaultChoiceRounds: Record<ChoiceLevel, number> = {
    1: 2,
    2: 1,
    3: 1,
    4: 1,
};

const typingTemplates: Record<TypingLevel, Array<(card: LetterCard) => string>> = {
    1: [
        (card) => `文字名「${card.nameJp}」の大文字を入力`,
        (card) => `「${card.keywordJp}」の頭文字（大文字）を入力`,
    ],
    2: [
        (card) => `文字名「${card.nameJp}」の小文字を入力`,
        (card) => `「${card.keywordJp}」の頭文字（小文字）を入力`,
    ],
    3: [
        (card) => `文字名「${card.nameJp}」のセット（大→小）を入力`,
        (card) => `「${card.keywordEn}」のセット（大→小）を入力`,
    ],
};

const choiceTemplates: Record<ChoiceLevel, Array<(card: LetterCard) => { promptJp: string; answerEn: string }>> = {
    1: [
        (card) => ({ promptJp: `文字名「${card.nameJp}」`, answerEn: card.upper }),
        (card) => ({ promptJp: `「${card.keywordJp}」の頭文字（大文字）`, answerEn: card.upper }),
    ],
    2: [
        (card) => ({ promptJp: `文字名「${card.nameJp}」の小文字`, answerEn: card.lower }),
        (card) => ({ promptJp: `「${card.keywordJp}」の頭文字（小文字）`, answerEn: card.lower }),
    ],
    3: [
        (card) => ({ promptJp: `文字名「${card.nameJp}」のキーワード`, answerEn: card.keywordEn }),
        (card) => ({ promptJp: `「${card.upper}${card.lower}」のキーワード`, answerEn: card.keywordEn }),
    ],
    4: [
        (card) => ({ promptJp: `「${card.keywordJp}」の英語`, answerEn: card.keywordEn }),
        (card) => ({ promptJp: `文字名「${card.nameJp}」のキーワード英語`, answerEn: card.keywordEn }),
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
    if (level === 1) return card.upper;
    if (level === 2) return card.lower;
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
        name: 'Unit 1: 基礎（大文字の定着）',
        parts: [
            {
                id: 'alpb-unit-1-part-1',
                label: 'A-L',
                pos: 'alphabet-foundation-a-l',
                category: ['alphabet', 'foundation', 'uppercase-first'],
                sections: [
                    {
                        id: 'alpb-unit-1-part-1-section-1',
                        type: 'alpb-unit-1-part-1-section-1',
                        label: 'A-D',
                        uppers: ['A', 'B', 'C', 'D'],
                    },
                    {
                        id: 'alpb-unit-1-part-1-section-2',
                        type: 'alpb-unit-1-part-1-section-2',
                        label: 'E-H',
                        uppers: ['E', 'F', 'G', 'H'],
                    },
                    {
                        id: 'alpb-unit-1-part-1-section-3',
                        type: 'alpb-unit-1-part-1-section-3',
                        label: 'I-L',
                        uppers: ['I', 'J', 'K', 'L'],
                    },
                ],
            },
            {
                id: 'alpb-unit-1-part-2',
                label: 'M-Z',
                pos: 'alphabet-foundation-m-z',
                category: ['alphabet', 'foundation', 'uppercase-first'],
                sections: [
                    {
                        id: 'alpb-unit-1-part-2-section-1',
                        type: 'alpb-unit-1-part-2-section-1',
                        label: 'M-P',
                        uppers: ['M', 'N', 'O', 'P'],
                    },
                    {
                        id: 'alpb-unit-1-part-2-section-2',
                        type: 'alpb-unit-1-part-2-section-2',
                        label: 'Q-T',
                        uppers: ['Q', 'R', 'S', 'T'],
                    },
                    {
                        id: 'alpb-unit-1-part-2-section-3',
                        type: 'alpb-unit-1-part-2-section-3',
                        label: 'U-Z',
                        uppers: ['U', 'V', 'W', 'X', 'Y', 'Z'],
                        typingOffset: 1,
                        choiceOffset: 1,
                    },
                ],
            },
        ],
    },
    {
        id: 'alpb-unit-2',
        name: 'Unit 2: 橋渡し（小文字・ペア・形の違い）',
        parts: [
            {
                id: 'alpb-unit-2-part-1',
                label: '小文字フォーカス',
                pos: 'alphabet-bridge-lowercase',
                category: ['alphabet', 'bridge', 'lowercase'],
                sections: [
                    {
                        id: 'alpb-unit-2-part-1-section-1',
                        type: 'alpb-unit-2-part-1-section-1',
                        label: 'A-L 小文字',
                        uppers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
                        typingRounds: { 1: 1, 2: 2, 3: 1 },
                        choiceRounds: { 1: 1, 2: 2, 3: 1, 4: 1 },
                    },
                    {
                        id: 'alpb-unit-2-part-1-section-2',
                        type: 'alpb-unit-2-part-1-section-2',
                        label: 'M-Z 小文字',
                        uppers: ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
                        typingRounds: { 1: 1, 2: 2, 3: 1 },
                        choiceRounds: { 1: 1, 2: 2, 3: 1, 4: 1 },
                        typingOffset: 1,
                        choiceOffset: 1,
                    },
                ],
            },
            {
                id: 'alpb-unit-2-part-2',
                label: 'ペア入力フォーカス',
                pos: 'alphabet-bridge-pair',
                category: ['alphabet', 'bridge', 'pair'],
                sections: [
                    {
                        id: 'alpb-unit-2-part-2-section-1',
                        type: 'alpb-unit-2-part-2-section-1',
                        label: 'A-L ペア',
                        uppers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
                        typingRounds: { 1: 1, 2: 1, 3: 2 },
                        choiceRounds: { 1: 1, 2: 1, 3: 1, 4: 1 },
                        typingOffset: 2,
                        choiceOffset: 2,
                    },
                    {
                        id: 'alpb-unit-2-part-2-section-2',
                        type: 'alpb-unit-2-part-2-section-2',
                        label: 'M-Z ペア',
                        uppers: ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
                        typingRounds: { 1: 1, 2: 1, 3: 2 },
                        choiceRounds: { 1: 1, 2: 1, 3: 1, 4: 1 },
                        typingOffset: 1,
                        choiceOffset: 1,
                    },
                ],
            },
            {
                id: 'alpb-unit-2-part-3',
                label: 'まぎらわし文字',
                pos: 'alphabet-bridge-confusable',
                category: ['alphabet', 'bridge', 'confusable'],
                sections: [
                    {
                        id: 'alpb-unit-2-part-3-section-1',
                        type: 'alpb-unit-2-part-3-section-1',
                        label: 'B/D/P/Q + I/L/J/T + U/V/W/Y',
                        uppers: ['B', 'D', 'P', 'Q', 'I', 'L', 'J', 'T', 'U', 'V', 'W', 'Y'],
                        typingRounds: { 1: 2, 2: 2, 3: 2 },
                        choiceRounds: { 1: 2, 2: 2, 3: 2, 4: 2 },
                    },
                ],
            },
        ],
    },
    {
        id: 'alpb-unit-3',
        name: 'Unit 3: 運用（取り出しと定着）',
        parts: [
            {
                id: 'alpb-unit-3-part-1',
                label: 'キーワード連結',
                pos: 'alphabet-application-keyword',
                category: ['alphabet', 'application', 'keyword-link'],
                sections: [
                    {
                        id: 'alpb-unit-3-part-1-section-1',
                        type: 'alpb-unit-3-part-1-section-1',
                        label: 'A-I',
                        uppers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
                        typingRounds: { 1: 1, 2: 1, 3: 2 },
                        choiceRounds: { 1: 1, 2: 1, 3: 2, 4: 2 },
                    },
                    {
                        id: 'alpb-unit-3-part-1-section-2',
                        type: 'alpb-unit-3-part-1-section-2',
                        label: 'J-R',
                        uppers: ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
                        typingRounds: { 1: 1, 2: 1, 3: 2 },
                        choiceRounds: { 1: 1, 2: 1, 3: 2, 4: 2 },
                        typingOffset: 1,
                        choiceOffset: 1,
                    },
                    {
                        id: 'alpb-unit-3-part-1-section-3',
                        type: 'alpb-unit-3-part-1-section-3',
                        label: 'S-Z',
                        uppers: ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
                        typingRounds: { 1: 1, 2: 1, 3: 2 },
                        choiceRounds: { 1: 1, 2: 1, 3: 2, 4: 2 },
                        typingOffset: 2,
                        choiceOffset: 2,
                    },
                ],
            },
            {
                id: 'alpb-unit-3-part-2',
                label: '総合マスター',
                pos: 'alphabet-application-mastery',
                category: ['alphabet', 'application', 'mastery'],
                sections: [
                    {
                        id: 'alpb-unit-3-part-2-section-1',
                        type: 'alpb-unit-3-part-2-section-1',
                        label: '全26ミックス',
                        uppers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
                        typingRounds: { 1: 1, 2: 1, 3: 1 },
                        choiceRounds: { 1: 1, 2: 1, 3: 1, 4: 1 },
                        typingOffset: 1,
                        choiceOffset: 1,
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
