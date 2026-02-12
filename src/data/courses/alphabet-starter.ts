// ================================
// Course Data: Alphabet Starter
// ================================

import { Course, Question } from '@/types';

type Seed = {
    promptJp: string;
    answerEn: string;
};

type SectionDef = {
    id: string;
    type: string;
    label: string;
    seeds: Seed[];
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

type CasePair = {
    upper: string;
    lower: string;
};

const courseName = 'Alphabet Starter';

const casePairs: CasePair[] = [
    { upper: 'A', lower: 'a' },
    { upper: 'B', lower: 'b' },
    { upper: 'C', lower: 'c' },
    { upper: 'D', lower: 'd' },
    { upper: 'E', lower: 'e' },
    { upper: 'F', lower: 'f' },
    { upper: 'G', lower: 'g' },
    { upper: 'H', lower: 'h' },
    { upper: 'I', lower: 'i' },
    { upper: 'J', lower: 'j' },
    { upper: 'K', lower: 'k' },
    { upper: 'L', lower: 'l' },
    { upper: 'M', lower: 'm' },
    { upper: 'N', lower: 'n' },
    { upper: 'O', lower: 'o' },
    { upper: 'P', lower: 'p' },
    { upper: 'Q', lower: 'q' },
    { upper: 'R', lower: 'r' },
    { upper: 'S', lower: 's' },
    { upper: 'T', lower: 't' },
    { upper: 'U', lower: 'u' },
    { upper: 'V', lower: 'v' },
    { upper: 'W', lower: 'w' },
    { upper: 'X', lower: 'x' },
    { upper: 'Y', lower: 'y' },
    { upper: 'Z', lower: 'z' },
];

function pairByUpper(upper: string): CasePair {
    const pair = casePairs.find((item) => item.upper === upper);
    if (!pair) {
        throw new Error(`Unknown alphabet pair: ${upper}`);
    }
    return pair;
}

function buildCaseDrill(uppers: string[], rounds = 2): Seed[] {
    const pairs = uppers.map((upper) => pairByUpper(upper));
    const seeds: Seed[] = [];

    for (let round = 0; round < rounds; round += 1) {
        pairs.forEach(({ upper, lower }) => {
            seeds.push({ promptJp: `${upper} と同じ小文字`, answerEn: lower });
            seeds.push({ promptJp: `${lower} と同じ大文字`, answerEn: upper });
        });
    }

    pairs.forEach(({ upper, lower }) => {
        seeds.push({ promptJp: `大文字 ${upper}`, answerEn: upper });
        seeds.push({ promptJp: `小文字 ${lower}`, answerEn: lower });
    });

    return seeds;
}

function buildConfusableDrill(groupA: string, groupB: string, rounds = 3): Seed[] {
    const seeds: Seed[] = [];

    for (let round = 0; round < rounds; round += 1) {
        seeds.push({ promptJp: `${groupA} を入力`, answerEn: groupA });
        seeds.push({ promptJp: `${groupB} を入力`, answerEn: groupB });
        seeds.push({ promptJp: `${groupA}${groupB} の順`, answerEn: `${groupA}${groupB}` });
        seeds.push({ promptJp: `${groupB}${groupA} の順`, answerEn: `${groupB}${groupA}` });
    }

    return seeds;
}

function buildMixedRecognition(uppers: string[], rounds = 2): Seed[] {
    const pairs = uppers.map((upper) => pairByUpper(upper));
    const seeds: Seed[] = [];

    for (let round = 0; round < rounds; round += 1) {
        pairs.forEach(({ upper, lower }, index) => {
            if ((round + index) % 2 === 0) {
                seeds.push({ promptJp: `${upper} の小文字`, answerEn: lower });
                seeds.push({ promptJp: `${lower} の大文字`, answerEn: upper });
            } else {
                seeds.push({ promptJp: `${lower} を入力`, answerEn: lower });
                seeds.push({ promptJp: `${upper} を入力`, answerEn: upper });
            }
        });
    }

    return seeds;
}

const units: UnitDef[] = [
    {
        id: 'alp-unit-1',
        name: 'Unit 1: アルファベット対応（A-I）',
        parts: [
            {
                id: 'alp-unit-1-part-1',
                label: '母音と基本形',
                pos: 'alphabet-case-basic',
                category: ['alphabet', 'recognition', 'case-link'],
                sections: [
                    {
                        id: 'alp-unit-1-part-1-section-1',
                        type: 'alp-unit-1-part-1-section-1',
                        label: 'A/a E/e I/i',
                        seeds: buildCaseDrill(['A', 'E', 'I'], 2),
                    },
                    {
                        id: 'alp-unit-1-part-1-section-2',
                        type: 'alp-unit-1-part-1-section-2',
                        label: 'O/o U/u C/c',
                        seeds: buildCaseDrill(['O', 'U', 'C'], 2),
                    },
                    {
                        id: 'alp-unit-1-part-1-section-3',
                        type: 'alp-unit-1-part-1-section-3',
                        label: 'F/f H/h L/l T/t',
                        seeds: buildCaseDrill(['F', 'H', 'L', 'T'], 2),
                    },
                ],
            },
            {
                id: 'alp-unit-1-part-2',
                label: 'A-I 復習ループ',
                pos: 'alphabet-case-review-a-i',
                category: ['alphabet', 'review', 'spiral'],
                sections: [
                    {
                        id: 'alp-unit-1-part-2-section-1',
                        type: 'alp-unit-1-part-2-section-1',
                        label: 'A-I 総合1',
                        seeds: buildMixedRecognition(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 2),
                    },
                    {
                        id: 'alp-unit-1-part-2-section-2',
                        type: 'alp-unit-1-part-2-section-2',
                        label: 'A-I 総合2',
                        seeds: buildCaseDrill(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 1),
                    },
                ],
            },
        ],
    },
    {
        id: 'alp-unit-2',
        name: 'Unit 2: まぎらわしい文字の見分け',
        parts: [
            {
                id: 'alp-unit-2-part-1',
                label: 'b/d と p/q',
                pos: 'alphabet-lower-confusable-core',
                category: ['alphabet', 'confusable', 'lower'],
                sections: [
                    {
                        id: 'alp-unit-2-part-1-section-1',
                        type: 'alp-unit-2-part-1-section-1',
                        label: 'b と d',
                        seeds: buildConfusableDrill('b', 'd', 4),
                    },
                    {
                        id: 'alp-unit-2-part-1-section-2',
                        type: 'alp-unit-2-part-1-section-2',
                        label: 'p と q',
                        seeds: buildConfusableDrill('p', 'q', 4),
                    },
                    {
                        id: 'alp-unit-2-part-1-section-3',
                        type: 'alp-unit-2-part-1-section-3',
                        label: 'b d p q ミックス',
                        seeds: [
                            ...buildConfusableDrill('bd', 'pq', 2),
                            ...buildConfusableDrill('bp', 'dq', 2),
                            ...buildCaseDrill(['B', 'D', 'P', 'Q'], 1),
                        ],
                    },
                ],
            },
            {
                id: 'alp-unit-2-part-2',
                label: '細部の差（i/l/j, m/n/h/r, u/v/w/y）',
                pos: 'alphabet-lower-confusable-extended',
                category: ['alphabet', 'confusable', 'shape'],
                sections: [
                    {
                        id: 'alp-unit-2-part-2-section-1',
                        type: 'alp-unit-2-part-2-section-1',
                        label: 'i l j',
                        seeds: [
                            ...buildConfusableDrill('i', 'l', 3),
                            ...buildConfusableDrill('i', 'j', 2),
                            ...buildCaseDrill(['I', 'L', 'J'], 1),
                        ],
                    },
                    {
                        id: 'alp-unit-2-part-2-section-2',
                        type: 'alp-unit-2-part-2-section-2',
                        label: 'm n h r',
                        seeds: [
                            ...buildConfusableDrill('m', 'n', 2),
                            ...buildConfusableDrill('n', 'h', 2),
                            ...buildConfusableDrill('h', 'r', 2),
                            ...buildCaseDrill(['M', 'N', 'H', 'R'], 1),
                        ],
                    },
                    {
                        id: 'alp-unit-2-part-2-section-3',
                        type: 'alp-unit-2-part-2-section-3',
                        label: 'u v w y',
                        seeds: [
                            ...buildConfusableDrill('u', 'v', 2),
                            ...buildConfusableDrill('v', 'w', 2),
                            ...buildConfusableDrill('w', 'y', 2),
                            ...buildCaseDrill(['U', 'V', 'W', 'Y'], 1),
                        ],
                    },
                ],
            },
            {
                id: 'alp-unit-2-part-3',
                label: '見分け総合復習',
                pos: 'alphabet-confusable-review',
                category: ['alphabet', 'review', 'confusable'],
                sections: [
                    {
                        id: 'alp-unit-2-part-3-section-1',
                        type: 'alp-unit-2-part-3-section-1',
                        label: 'まぎらわし総合1',
                        seeds: [
                            ...buildMixedRecognition(['B', 'D', 'P', 'Q', 'I', 'L', 'J'], 2),
                            ...buildConfusableDrill('bd', 'pq', 2),
                        ],
                    },
                    {
                        id: 'alp-unit-2-part-3-section-2',
                        type: 'alp-unit-2-part-3-section-2',
                        label: 'まぎらわし総合2',
                        seeds: [
                            ...buildMixedRecognition(['M', 'N', 'H', 'R', 'U', 'V', 'W', 'Y'], 2),
                            ...buildConfusableDrill('mn', 'hr', 2),
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'alp-unit-3',
        name: 'Unit 3: 全26スパイラル復習',
        parts: [
            {
                id: 'alp-unit-3-part-1',
                label: 'A-M 対応定着',
                pos: 'alphabet-spiral-a-m',
                category: ['alphabet', 'review', 'a-m'],
                sections: [
                    {
                        id: 'alp-unit-3-part-1-section-1',
                        type: 'alp-unit-3-part-1-section-1',
                        label: 'A-F',
                        seeds: buildMixedRecognition(['A', 'B', 'C', 'D', 'E', 'F'], 3),
                    },
                    {
                        id: 'alp-unit-3-part-1-section-2',
                        type: 'alp-unit-3-part-1-section-2',
                        label: 'G-M',
                        seeds: buildMixedRecognition(['G', 'H', 'I', 'J', 'K', 'L', 'M'], 3),
                    },
                    {
                        id: 'alp-unit-3-part-1-section-3',
                        type: 'alp-unit-3-part-1-section-3',
                        label: 'A-M ミックス',
                        seeds: buildCaseDrill(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'], 1),
                    },
                ],
            },
            {
                id: 'alp-unit-3-part-2',
                label: 'N-Z 対応定着',
                pos: 'alphabet-spiral-n-z',
                category: ['alphabet', 'review', 'n-z'],
                sections: [
                    {
                        id: 'alp-unit-3-part-2-section-1',
                        type: 'alp-unit-3-part-2-section-1',
                        label: 'N-S',
                        seeds: buildMixedRecognition(['N', 'O', 'P', 'Q', 'R', 'S'], 3),
                    },
                    {
                        id: 'alp-unit-3-part-2-section-2',
                        type: 'alp-unit-3-part-2-section-2',
                        label: 'T-Z',
                        seeds: buildMixedRecognition(['T', 'U', 'V', 'W', 'X', 'Y', 'Z'], 3),
                    },
                    {
                        id: 'alp-unit-3-part-2-section-3',
                        type: 'alp-unit-3-part-2-section-3',
                        label: 'N-Z ミックス',
                        seeds: buildCaseDrill(['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'], 1),
                    },
                ],
            },
            {
                id: 'alp-unit-3-part-3',
                label: '最終復習（全26 + まぎらわし）',
                pos: 'alphabet-final-review',
                category: ['alphabet', 'review', 'final'],
                sections: [
                    {
                        id: 'alp-unit-3-part-3-section-1',
                        type: 'alp-unit-3-part-3-section-1',
                        label: '全26対応',
                        seeds: buildMixedRecognition(
                            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
                            1,
                        ),
                    },
                    {
                        id: 'alp-unit-3-part-3-section-2',
                        type: 'alp-unit-3-part-3-section-2',
                        label: 'まぎらわし集中',
                        seeds: [
                            ...buildConfusableDrill('b', 'd', 3),
                            ...buildConfusableDrill('p', 'q', 3),
                            ...buildConfusableDrill('m', 'n', 2),
                            ...buildConfusableDrill('u', 'v', 2),
                        ],
                    },
                    {
                        id: 'alp-unit-3-part-3-section-3',
                        type: 'alp-unit-3-part-3-section-3',
                        label: '総合チェック',
                        seeds: [
                            ...buildCaseDrill(['A', 'E', 'I', 'O', 'U', 'B', 'D', 'P', 'Q', 'M', 'N', 'V', 'W', 'X', 'Y', 'Z'], 1),
                            ...buildMixedRecognition(['C', 'F', 'G', 'H', 'J', 'K', 'L', 'R', 'S', 'T'], 1),
                        ],
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
    id: `alp-q${serial++}`,
    course: courseName,
    unit: unitName,
    partId,
    section: sectionId,
    sectionLabel,
    promptJp: seed.promptJp,
    answerEn: seed.answerEn,
    pos: [pos],
    category,
    orderIndex,
});

units.forEach((unit) => {
    unit.parts.forEach((part) => {
        part.sections.forEach((section) => {
            section.seeds.forEach((seed, idx) => {
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
    id: 'course-alphabet-starter',
    name: courseName,
    units: units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        parts: unit.parts.map((part) => ({
            id: part.id,
            label: part.label,
            totalQuestions: part.sections.reduce((sum, section) => sum + section.seeds.length, 0),
            sections: part.sections.map((section) => ({
                id: section.id,
                type: section.type,
                label: section.label,
                questionIds: questions.filter((q) => q.section === section.id).map((q) => q.id),
            })),
        })),
    })),
};
