// ================================
// Course Data: Typing Foundation
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

const courseName = 'Typing Foundation';

const units: UnitDef[] = [
    {
        id: 'tbf-unit-1',
        name: 'Unit 1: ホームポジション',
        parts: [
            {
                id: 'tbf-unit-1-part-1',
                label: '左手（ASDF）',
                pos: 'typing-home-left',
                category: ['typing', 'home-row', 'left'],
                sections: [
                    {
                        id: 'tbf-unit-1-part-1-section-1',
                        type: 'tbf-unit-1-part-1-section-1',
                        label: 'A/S',
                        seeds: [
                            { promptJp: 'Aキー', answerEn: 'a' },
                            { promptJp: 'Sキー', answerEn: 's' },
                            { promptJp: 'AS', answerEn: 'as' },
                            { promptJp: 'SA', answerEn: 'sa' },
                        ],
                    },
                    {
                        id: 'tbf-unit-1-part-1-section-2',
                        type: 'tbf-unit-1-part-1-section-2',
                        label: 'D/F',
                        seeds: [
                            { promptJp: 'Dキー', answerEn: 'd' },
                            { promptJp: 'Fキー', answerEn: 'f' },
                            { promptJp: 'DF', answerEn: 'df' },
                            { promptJp: 'FD', answerEn: 'fd' },
                        ],
                    },
                    {
                        id: 'tbf-unit-1-part-1-section-3',
                        type: 'tbf-unit-1-part-1-section-3',
                        label: 'ASDF',
                        seeds: [
                            { promptJp: 'ASDF', answerEn: 'asdf' },
                            { promptJp: 'FDSA', answerEn: 'fdsa' },
                            { promptJp: 'AFSD', answerEn: 'afsd' },
                            { promptJp: 'SDFA', answerEn: 'sdfa' },
                        ],
                    },
                ],
            },
            {
                id: 'tbf-unit-1-part-2',
                label: '右手（JKL;）',
                pos: 'typing-home-right',
                category: ['typing', 'home-row', 'right'],
                sections: [
                    {
                        id: 'tbf-unit-1-part-2-section-1',
                        type: 'tbf-unit-1-part-2-section-1',
                        label: 'J/K',
                        seeds: [
                            { promptJp: 'Jキー', answerEn: 'j' },
                            { promptJp: 'Kキー', answerEn: 'k' },
                            { promptJp: 'JK', answerEn: 'jk' },
                            { promptJp: 'KJ', answerEn: 'kj' },
                        ],
                    },
                    {
                        id: 'tbf-unit-1-part-2-section-2',
                        type: 'tbf-unit-1-part-2-section-2',
                        label: 'L/;',
                        seeds: [
                            { promptJp: 'Lキー', answerEn: 'l' },
                            { promptJp: ';キー', answerEn: ';' },
                            { promptJp: 'L;', answerEn: 'l;' },
                            { promptJp: ';L', answerEn: ';l' },
                        ],
                    },
                    {
                        id: 'tbf-unit-1-part-2-section-3',
                        type: 'tbf-unit-1-part-2-section-3',
                        label: 'JKL;',
                        seeds: [
                            { promptJp: 'JKL;', answerEn: 'jkl;' },
                            { promptJp: ';LKJ', answerEn: ';lkj' },
                            { promptJp: 'J;KL', answerEn: 'j;kl' },
                            { promptJp: 'KL;J', answerEn: 'kl;j' },
                        ],
                    },
                ],
            },
            {
                id: 'tbf-unit-1-part-3',
                label: '両手ホーム列',
                pos: 'typing-home-both',
                category: ['typing', 'home-row', 'both'],
                sections: [
                    {
                        id: 'tbf-unit-1-part-3-section-1',
                        type: 'tbf-unit-1-part-3-section-1',
                        label: 'ASDF + JKL;',
                        seeds: [
                            { promptJp: 'FJ', answerEn: 'fj' },
                            { promptJp: 'DK', answerEn: 'dk' },
                            { promptJp: 'SL', answerEn: 'sl' },
                            { promptJp: 'A;', answerEn: 'a;' },
                        ],
                    },
                    {
                        id: 'tbf-unit-1-part-3-section-2',
                        type: 'tbf-unit-1-part-3-section-2',
                        label: '短パターン（ASD / JKL / FJ）',
                        seeds: [
                            { promptJp: 'ASD', answerEn: 'asd' },
                            { promptJp: 'JKL', answerEn: 'jkl' },
                            { promptJp: 'FJ', answerEn: 'fj' },
                            { promptJp: 'DFJK', answerEn: 'dfjk' },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'tbf-unit-2',
        name: 'Unit 2: 上段（ホーム列と混合）',
        parts: [
            {
                id: 'tbf-unit-2-part-1',
                label: '左上段（QWERT）',
                pos: 'typing-top-left',
                category: ['typing', 'top-row', 'left'],
                sections: [
                    {
                        id: 'tbf-unit-2-part-1-section-1',
                        type: 'tbf-unit-2-part-1-section-1',
                        label: 'QWERT',
                        seeds: [
                            { promptJp: 'Q', answerEn: 'q' },
                            { promptJp: 'W', answerEn: 'w' },
                            { promptJp: 'E', answerEn: 'e' },
                            { promptJp: 'RT', answerEn: 'rt' },
                        ],
                    },
                ],
            },
            {
                id: 'tbf-unit-2-part-2',
                label: '右上段（YUIOP）',
                pos: 'typing-top-right',
                category: ['typing', 'top-row', 'right'],
                sections: [
                    {
                        id: 'tbf-unit-2-part-2-section-1',
                        type: 'tbf-unit-2-part-2-section-1',
                        label: 'YUIOP',
                        seeds: [
                            { promptJp: 'Y', answerEn: 'y' },
                            { promptJp: 'U', answerEn: 'u' },
                            { promptJp: 'I', answerEn: 'i' },
                            { promptJp: 'OP', answerEn: 'op' },
                        ],
                    },
                ],
            },
            {
                id: 'tbf-unit-2-part-3',
                label: '上段＋ホーム列',
                pos: 'typing-top-home-mix',
                category: ['typing', 'top-row', 'mix'],
                sections: [
                    {
                        id: 'tbf-unit-2-part-3-section-1',
                        type: 'tbf-unit-2-part-3-section-1',
                        label: '上段＋ホーム列',
                        seeds: [
                            { promptJp: 'QAZ ではなく QAS', answerEn: 'qas' },
                            { promptJp: 'WER + SDF', answerEn: 'wersdf' },
                            { promptJp: 'UIO + JKL', answerEn: 'uiojkl' },
                            { promptJp: 'TY + GH', answerEn: 'tygh' },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'tbf-unit-3',
        name: 'Unit 3: 下段（ホーム列と混合）',
        parts: [
            {
                id: 'tbf-unit-3-part-1',
                label: '左下段（ZXCVB）',
                pos: 'typing-bottom-left',
                category: ['typing', 'bottom-row', 'left'],
                sections: [
                    {
                        id: 'tbf-unit-3-part-1-section-1',
                        type: 'tbf-unit-3-part-1-section-1',
                        label: 'ZXCVB',
                        seeds: [
                            { promptJp: 'Z', answerEn: 'z' },
                            { promptJp: 'X', answerEn: 'x' },
                            { promptJp: 'CV', answerEn: 'cv' },
                            { promptJp: 'VB', answerEn: 'vb' },
                        ],
                    },
                ],
            },
            {
                id: 'tbf-unit-3-part-2',
                label: '右下段（NM,./）',
                pos: 'typing-bottom-right',
                category: ['typing', 'bottom-row', 'right'],
                sections: [
                    {
                        id: 'tbf-unit-3-part-2-section-1',
                        type: 'tbf-unit-3-part-2-section-1',
                        label: 'NM,./',
                        seeds: [
                            { promptJp: 'N', answerEn: 'n' },
                            { promptJp: 'M', answerEn: 'm' },
                            { promptJp: ',.', answerEn: ',.' },
                            { promptJp: './', answerEn: './' },
                        ],
                    },
                ],
            },
            {
                id: 'tbf-unit-3-part-3',
                label: '下段＋ホーム列',
                pos: 'typing-bottom-home-mix',
                category: ['typing', 'bottom-row', 'mix'],
                sections: [
                    {
                        id: 'tbf-unit-3-part-3-section-1',
                        type: 'tbf-unit-3-part-3-section-1',
                        label: '下段＋ホーム列',
                        seeds: [
                            { promptJp: 'zxc + asd', answerEn: 'zxcasd' },
                            { promptJp: 'nm, + jkl', answerEn: 'nm,jkl' },
                            { promptJp: 'vbn + fgh', answerEn: 'vbnfgh' },
                            { promptJp: ',./ + jkl;', answerEn: ',./jkl;' },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'tbf-unit-4',
        name: 'Unit 4: レビュー＋大文字',
        parts: [
            {
                id: 'tbf-unit-4-part-1',
                label: '左手/右手単語',
                pos: 'typing-review-words',
                category: ['typing', 'word'],
                sections: [
                    {
                        id: 'tbf-unit-4-part-1-section-1',
                        type: 'tbf-unit-4-part-1-section-1',
                        label: '3〜5文字単語',
                        seeds: [
                            { promptJp: 'cat', answerEn: 'cat' },
                            { promptJp: 'dog', answerEn: 'dog' },
                            { promptJp: 'sun', answerEn: 'sun' },
                            { promptJp: 'hand', answerEn: 'hand' },
                            { promptJp: 'jump', answerEn: 'jump' },
                        ],
                    },
                ],
            },
            {
                id: 'tbf-unit-4-part-2',
                label: '両手交互（左右切替）',
                pos: 'typing-review-alternate',
                category: ['typing', 'pattern'],
                sections: [
                    {
                        id: 'tbf-unit-4-part-2-section-1',
                        type: 'tbf-unit-4-part-2-section-1',
                        label: '左右切替パターン',
                        seeds: [
                            { promptJp: 'fa', answerEn: 'fa' },
                            { promptJp: 'jo', answerEn: 'jo' },
                            { promptJp: 'deki', answerEn: 'deki' },
                            { promptJp: 'sul;', answerEn: 'sul;' },
                            { promptJp: 'fghj', answerEn: 'fghj' },
                        ],
                    },
                ],
            },
            {
                id: 'tbf-unit-4-part-3',
                label: 'Shiftで大文字（ホーム＋上段＋下段）',
                pos: 'typing-review-uppercase',
                category: ['typing', 'uppercase'],
                sections: [
                    {
                        id: 'tbf-unit-4-part-3-section-1',
                        type: 'tbf-unit-4-part-3-section-1',
                        label: '大文字混じり短語',
                        seeds: [
                            { promptJp: 'Cat', answerEn: 'Cat' },
                            { promptJp: 'Dog', answerEn: 'Dog' },
                            { promptJp: 'Sun', answerEn: 'Sun' },
                            { promptJp: 'Fast', answerEn: 'Fast' },
                            { promptJp: 'Jump', answerEn: 'Jump' },
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
    id: `tbf-q${serial++}`,
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
    id: 'course-typing-foundation',
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
