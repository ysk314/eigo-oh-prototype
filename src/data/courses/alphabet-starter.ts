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

const courseName = 'Alphabet Starter';

const units: UnitDef[] = [
    {
        id: 'alp-unit-1',
        name: 'Unit 1: 形の認識（大文字）',
        parts: [
            {
                id: 'alp-unit-1-part-1',
                label: '直線系',
                pos: 'alphabet-upper-linear',
                category: ['alphabet', 'recognition', 'upper'],
                sections: [
                    {
                        id: 'alp-unit-1-part-1-section-1',
                        type: 'alp-unit-1-part-1-section-1',
                        label: 'A E F',
                        seeds: [
                            { promptJp: '大文字 A', answerEn: 'A' },
                            { promptJp: '大文字 E', answerEn: 'E' },
                            { promptJp: '大文字 F', answerEn: 'F' },
                        ],
                    },
                    {
                        id: 'alp-unit-1-part-1-section-2',
                        type: 'alp-unit-1-part-1-section-2',
                        label: 'H I L',
                        seeds: [
                            { promptJp: '大文字 H', answerEn: 'H' },
                            { promptJp: '大文字 I', answerEn: 'I' },
                            { promptJp: '大文字 L', answerEn: 'L' },
                        ],
                    },
                    {
                        id: 'alp-unit-1-part-1-section-3',
                        type: 'alp-unit-1-part-1-section-3',
                        label: 'T',
                        seeds: [
                            { promptJp: '大文字 T', answerEn: 'T' },
                        ],
                    },
                ],
            },
            {
                id: 'alp-unit-1-part-2',
                label: '曲線系',
                pos: 'alphabet-upper-curve',
                category: ['alphabet', 'recognition', 'upper'],
                sections: [
                    {
                        id: 'alp-unit-1-part-2-section-1',
                        type: 'alp-unit-1-part-2-section-1',
                        label: 'B C D',
                        seeds: [
                            { promptJp: '大文字 B', answerEn: 'B' },
                            { promptJp: '大文字 C', answerEn: 'C' },
                            { promptJp: '大文字 D', answerEn: 'D' },
                        ],
                    },
                    {
                        id: 'alp-unit-1-part-2-section-2',
                        type: 'alp-unit-1-part-2-section-2',
                        label: 'G J O',
                        seeds: [
                            { promptJp: '大文字 G', answerEn: 'G' },
                            { promptJp: '大文字 J', answerEn: 'J' },
                            { promptJp: '大文字 O', answerEn: 'O' },
                        ],
                    },
                    {
                        id: 'alp-unit-1-part-2-section-3',
                        type: 'alp-unit-1-part-2-section-3',
                        label: 'P Q R S U',
                        seeds: [
                            { promptJp: '大文字 P', answerEn: 'P' },
                            { promptJp: '大文字 Q', answerEn: 'Q' },
                            { promptJp: '大文字 R', answerEn: 'R' },
                            { promptJp: '大文字 S', answerEn: 'S' },
                            { promptJp: '大文字 U', answerEn: 'U' },
                        ],
                    },
                ],
            },
            {
                id: 'alp-unit-1-part-3',
                label: '斜線系',
                pos: 'alphabet-upper-diagonal',
                category: ['alphabet', 'recognition', 'upper'],
                sections: [
                    {
                        id: 'alp-unit-1-part-3-section-1',
                        type: 'alp-unit-1-part-3-section-1',
                        label: 'K M N',
                        seeds: [
                            { promptJp: '大文字 K', answerEn: 'K' },
                            { promptJp: '大文字 M', answerEn: 'M' },
                            { promptJp: '大文字 N', answerEn: 'N' },
                        ],
                    },
                    {
                        id: 'alp-unit-1-part-3-section-2',
                        type: 'alp-unit-1-part-3-section-2',
                        label: 'V W X',
                        seeds: [
                            { promptJp: '大文字 V', answerEn: 'V' },
                            { promptJp: '大文字 W', answerEn: 'W' },
                            { promptJp: '大文字 X', answerEn: 'X' },
                        ],
                    },
                    {
                        id: 'alp-unit-1-part-3-section-3',
                        type: 'alp-unit-1-part-3-section-3',
                        label: 'Y Z',
                        seeds: [
                            { promptJp: '大文字 Y', answerEn: 'Y' },
                            { promptJp: '大文字 Z', answerEn: 'Z' },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'alp-unit-2',
        name: 'Unit 2: 形の認識（小文字）',
        parts: [
            {
                id: 'alp-unit-2-part-1',
                label: '形が近い小文字',
                pos: 'alphabet-lower-similar',
                category: ['alphabet', 'recognition', 'lower'],
                sections: [
                    {
                        id: 'alp-unit-2-part-1-section-1',
                        type: 'alp-unit-2-part-1-section-1',
                        label: 'a c e o u',
                        seeds: [
                            { promptJp: '小文字 a', answerEn: 'a' },
                            { promptJp: '小文字 c', answerEn: 'c' },
                            { promptJp: '小文字 e', answerEn: 'e' },
                            { promptJp: '小文字 o', answerEn: 'o' },
                            { promptJp: '小文字 u', answerEn: 'u' },
                        ],
                    },
                ],
            },
            {
                id: 'alp-unit-2-part-2',
                label: '似やすいペア',
                pos: 'alphabet-lower-confusable',
                category: ['alphabet', 'recognition', 'lower'],
                sections: [
                    {
                        id: 'alp-unit-2-part-2-section-1',
                        type: 'alp-unit-2-part-2-section-1',
                        label: 'b d p q',
                        seeds: [
                            { promptJp: '小文字 b', answerEn: 'b' },
                            { promptJp: '小文字 d', answerEn: 'd' },
                            { promptJp: '小文字 p', answerEn: 'p' },
                            { promptJp: '小文字 q', answerEn: 'q' },
                        ],
                    },
                    {
                        id: 'alp-unit-2-part-2-section-2',
                        type: 'alp-unit-2-part-2-section-2',
                        label: 'i l',
                        seeds: [
                            { promptJp: '小文字 i', answerEn: 'i' },
                            { promptJp: '小文字 l', answerEn: 'l' },
                        ],
                    },
                    {
                        id: 'alp-unit-2-part-2-section-3',
                        type: 'alp-unit-2-part-2-section-3',
                        label: 'n h m',
                        seeds: [
                            { promptJp: '小文字 n', answerEn: 'n' },
                            { promptJp: '小文字 h', answerEn: 'h' },
                            { promptJp: '小文字 m', answerEn: 'm' },
                        ],
                    },
                ],
            },
            {
                id: 'alp-unit-2-part-3',
                label: '斜線・特殊形',
                pos: 'alphabet-lower-diagonal-special',
                category: ['alphabet', 'recognition', 'lower'],
                sections: [
                    {
                        id: 'alp-unit-2-part-3-section-1',
                        type: 'alp-unit-2-part-3-section-1',
                        label: 'k v w',
                        seeds: [
                            { promptJp: '小文字 k', answerEn: 'k' },
                            { promptJp: '小文字 v', answerEn: 'v' },
                            { promptJp: '小文字 w', answerEn: 'w' },
                        ],
                    },
                    {
                        id: 'alp-unit-2-part-3-section-2',
                        type: 'alp-unit-2-part-3-section-2',
                        label: 'x y z',
                        seeds: [
                            { promptJp: '小文字 x', answerEn: 'x' },
                            { promptJp: '小文字 y', answerEn: 'y' },
                            { promptJp: '小文字 z', answerEn: 'z' },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'alp-unit-3',
        name: 'Unit 3: 大文字⇄小文字対応',
        parts: [
            {
                id: 'alp-unit-3-part-1',
                label: '同形寄り',
                pos: 'alphabet-case-similar',
                category: ['alphabet', 'case-match'],
                sections: [
                    {
                        id: 'alp-unit-3-part-1-section-1',
                        type: 'alp-unit-3-part-1-section-1',
                        label: 'C/c O/o S/s',
                        seeds: [
                            { promptJp: 'C の小文字', answerEn: 'c' },
                            { promptJp: 'o の大文字', answerEn: 'O' },
                            { promptJp: 'S の小文字', answerEn: 's' },
                        ],
                    },
                    {
                        id: 'alp-unit-3-part-1-section-2',
                        type: 'alp-unit-3-part-1-section-2',
                        label: 'V/v W/w X/x',
                        seeds: [
                            { promptJp: 'v の大文字', answerEn: 'V' },
                            { promptJp: 'W の小文字', answerEn: 'w' },
                            { promptJp: 'x の大文字', answerEn: 'X' },
                        ],
                    },
                    {
                        id: 'alp-unit-3-part-1-section-3',
                        type: 'alp-unit-3-part-1-section-3',
                        label: 'Z/z',
                        seeds: [
                            { promptJp: 'Z の小文字', answerEn: 'z' },
                            { promptJp: 'z の大文字', answerEn: 'Z' },
                        ],
                    },
                ],
            },
            {
                id: 'alp-unit-3-part-2',
                label: '形が違うペア',
                pos: 'alphabet-case-different',
                category: ['alphabet', 'case-match'],
                sections: [
                    {
                        id: 'alp-unit-3-part-2-section-1',
                        type: 'alp-unit-3-part-2-section-1',
                        label: 'A/a B/b D/d',
                        seeds: [
                            { promptJp: 'A の小文字', answerEn: 'a' },
                            { promptJp: 'b の大文字', answerEn: 'B' },
                            { promptJp: 'D の小文字', answerEn: 'd' },
                        ],
                    },
                    {
                        id: 'alp-unit-3-part-2-section-2',
                        type: 'alp-unit-3-part-2-section-2',
                        label: 'G/g Q/q R/r',
                        seeds: [
                            { promptJp: 'g の大文字', answerEn: 'G' },
                            { promptJp: 'Q の小文字', answerEn: 'q' },
                            { promptJp: 'r の大文字', answerEn: 'R' },
                        ],
                    },
                ],
            },
            {
                id: 'alp-unit-3-part-3',
                label: '混在ランダム（全26）',
                pos: 'alphabet-case-random',
                category: ['alphabet', 'case-match', 'mixed'],
                sections: [
                    {
                        id: 'alp-unit-3-part-3-section-1',
                        type: 'alp-unit-3-part-3-section-1',
                        label: 'A-I',
                        seeds: [
                            { promptJp: 'a の大文字', answerEn: 'A' },
                            { promptJp: 'B の小文字', answerEn: 'b' },
                            { promptJp: 'c の大文字', answerEn: 'C' },
                            { promptJp: 'D の小文字', answerEn: 'd' },
                            { promptJp: 'e の大文字', answerEn: 'E' },
                            { promptJp: 'F の小文字', answerEn: 'f' },
                            { promptJp: 'g の大文字', answerEn: 'G' },
                            { promptJp: 'H の小文字', answerEn: 'h' },
                            { promptJp: 'i の大文字', answerEn: 'I' },
                        ],
                    },
                    {
                        id: 'alp-unit-3-part-3-section-2',
                        type: 'alp-unit-3-part-3-section-2',
                        label: 'J-R',
                        seeds: [
                            { promptJp: 'J の小文字', answerEn: 'j' },
                            { promptJp: 'k の大文字', answerEn: 'K' },
                            { promptJp: 'L の小文字', answerEn: 'l' },
                            { promptJp: 'm の大文字', answerEn: 'M' },
                            { promptJp: 'N の小文字', answerEn: 'n' },
                            { promptJp: 'o の大文字', answerEn: 'O' },
                            { promptJp: 'P の小文字', answerEn: 'p' },
                            { promptJp: 'q の大文字', answerEn: 'Q' },
                            { promptJp: 'R の小文字', answerEn: 'r' },
                        ],
                    },
                    {
                        id: 'alp-unit-3-part-3-section-3',
                        type: 'alp-unit-3-part-3-section-3',
                        label: 'S-Z',
                        seeds: [
                            { promptJp: 's の大文字', answerEn: 'S' },
                            { promptJp: 'T の小文字', answerEn: 't' },
                            { promptJp: 'u の大文字', answerEn: 'U' },
                            { promptJp: 'V の小文字', answerEn: 'v' },
                            { promptJp: 'w の大文字', answerEn: 'W' },
                            { promptJp: 'X の小文字', answerEn: 'x' },
                            { promptJp: 'y の大文字', answerEn: 'Y' },
                            { promptJp: 'Z の小文字', answerEn: 'z' },
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
