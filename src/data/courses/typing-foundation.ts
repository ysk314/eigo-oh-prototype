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

const anchorPatterns = ['f', 'j', 'fj', 'jf', 'ffjj', 'jffj'];

function toTypingSeed(pattern: string, suffix = 'を入力'): Seed {
    return {
        promptJp: `${pattern} ${suffix}`,
        answerEn: pattern,
    };
}

function buildAnchorSeeds(rounds = 1): Seed[] {
    const seeds: Seed[] = [];
    for (let round = 0; round < rounds; round += 1) {
        anchorPatterns.forEach((pattern) => {
            seeds.push(toTypingSeed(pattern, '（F/J確認）'));
        });
    }
    return seeds;
}

function buildTypingSection(practice: string[], review: string[] = [], anchorRounds = 1): Seed[] {
    return [
        ...buildAnchorSeeds(anchorRounds),
        ...practice.map((pattern) => toTypingSeed(pattern)),
        ...review.map((pattern) => toTypingSeed(pattern, '（復習）')),
        ...buildAnchorSeeds(1),
    ];
}

const units: UnitDef[] = [
    {
        id: 'tbf-unit-1',
        name: 'Unit 1: ホーム基準（F/J最優先）',
        parts: [
            {
                id: 'tbf-unit-1-part-1',
                label: 'F/J アンカー',
                pos: 'typing-home-anchor',
                category: ['typing', 'home-row', 'anchor'],
                sections: [
                    {
                        id: 'tbf-unit-1-part-1-section-1',
                        type: 'tbf-unit-1-part-1-section-1',
                        label: 'F/J タッチ定着',
                        seeds: buildTypingSection(
                            ['f', 'j', 'fj', 'jf', 'fff', 'jjj', 'fjf', 'jfj', 'ffj', 'jjf'],
                            ['f', 'j', 'fj', 'jf'],
                            2,
                        ),
                    },
                    {
                        id: 'tbf-unit-1-part-1-section-2',
                        type: 'tbf-unit-1-part-1-section-2',
                        label: 'FJ + D/K',
                        seeds: buildTypingSection(
                            ['d', 'k', 'dk', 'kd', 'fdkj', 'jkdf', 'dfjk', 'kjfd', 'fdk', 'jkd'],
                            ['fj', 'jf', 'dk', 'kd'],
                            2,
                        ),
                    },
                    {
                        id: 'tbf-unit-1-part-1-section-3',
                        type: 'tbf-unit-1-part-1-section-3',
                        label: 'FJ + S/L',
                        seeds: buildTypingSection(
                            ['s', 'l', 'sl', 'ls', 'fsjl', 'ljsf', 'sflj', 'lsfj', 'fsl', 'jls'],
                            ['fj', 'jf', 'sl', 'ls'],
                            2,
                        ),
                    },
                    {
                        id: 'tbf-unit-1-part-1-section-4',
                        type: 'tbf-unit-1-part-1-section-4',
                        label: 'FJ + A/;',
                        seeds: buildTypingSection(
                            ['a', ';', 'a;', ';a', 'fa;j', 'j;af', 'a;fj', ';ajf', 'af;', 'j;a'],
                            ['fj', 'jf', 'a;', ';a'],
                            2,
                        ),
                    },
                ],
            },
            {
                id: 'tbf-unit-1-part-2',
                label: 'ホーム列拡張（ASDF / JKL;）',
                pos: 'typing-home-expand',
                category: ['typing', 'home-row', 'expand'],
                sections: [
                    {
                        id: 'tbf-unit-1-part-2-section-1',
                        type: 'tbf-unit-1-part-2-section-1',
                        label: '左手 ASDF',
                        seeds: buildTypingSection(
                            ['as', 'sa', 'df', 'fd', 'asd', 'sdf', 'fda', 'asdf', 'fdsa', 'safd'],
                            ['fj', 'jf', 'as', 'df'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-1-part-2-section-2',
                        type: 'tbf-unit-1-part-2-section-2',
                        label: '右手 JKL;',
                        seeds: buildTypingSection(
                            ['jk', 'kj', 'l;', ';l', 'jkl', 'kl;', ';lk', 'jkl;', ';lkj', 'kj;l'],
                            ['fj', 'jf', 'jk', 'l;'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-1-part-2-section-3',
                        type: 'tbf-unit-1-part-2-section-3',
                        label: '左右交互（FJ/DK/SL/A;）',
                        seeds: buildTypingSection(
                            ['fj', 'dk', 'sl', 'a;', 'fjdksl', 'dkslfj', 'a;slfj', 'fj;a', 'dk;f', 'slaf'],
                            ['asdf', 'jkl;', 'fj', 'jf'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-1-part-2-section-4',
                        type: 'tbf-unit-1-part-2-section-4',
                        label: 'ホーム列総合',
                        seeds: buildTypingSection(
                            ['asdf', 'jkl;', 'asdfjkl;', ';lkjfdsa', 'fjas', 'dkal', 'sl;j', 'a;df', 'fjdk', 'sl;a'],
                            ['fj', 'jf', 'asdf', 'jkl;'],
                            1,
                        ),
                    },
                ],
            },
            {
                id: 'tbf-unit-1-part-3',
                label: 'ホーム列 反復ループ',
                pos: 'typing-home-spiral-review',
                category: ['typing', 'home-row', 'review'],
                sections: [
                    {
                        id: 'tbf-unit-1-part-3-section-1',
                        type: 'tbf-unit-1-part-3-section-1',
                        label: '短チャンク反復',
                        seeds: buildTypingSection(
                            ['fj', 'jf', 'dk', 'kd', 'sl', 'ls', 'a;', ';a', 'fjdk', 'sla;'],
                            ['asdf', 'jkl;', 'fj', 'jf', 'dk', 'sl'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-1-part-3-section-2',
                        type: 'tbf-unit-1-part-3-section-2',
                        label: '長チャンク反復',
                        seeds: buildTypingSection(
                            ['asdfjkl;', 'jkl;asdf', 'fjdksla;', 'a;slkdfj', 'fjfjdkdk', 'slsl;a;a'],
                            ['fj', 'jf', 'asdf', 'jkl;', 'fjdk', 'a;sl'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-1-part-3-section-3',
                        type: 'tbf-unit-1-part-3-section-3',
                        label: 'ホーム列チェック',
                        seeds: buildTypingSection(
                            ['fast', 'ask', 'dad', 'fall', 'jazz', 'sad', 'all', 'jfk', 'lad', 'flask'],
                            ['fj', 'jf', 'asdf', 'jkl;', 'dk', 'sl'],
                            1,
                        ),
                    },
                ],
            },
        ],
    },
    {
        id: 'tbf-unit-2',
        name: 'Unit 2: 上段導入（ホーム列と反復）',
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
                        label: 'Q/W/E',
                        seeds: buildTypingSection(
                            ['q', 'w', 'e', 'qw', 'we', 'eq', 'qwe', 'weq', 'qaws', 'wefd'],
                            ['fj', 'jf', 'asdf'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-2-part-1-section-2',
                        type: 'tbf-unit-2-part-1-section-2',
                        label: 'R/T + ホーム列',
                        seeds: buildTypingSection(
                            ['r', 't', 'rt', 'tr', 'wert', 'trew', 'rfvt', 'tgfr', 'rtdf', 'tref'],
                            ['fj', 'jf', 'qwe', 'asdf'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-2-part-1-section-3',
                        type: 'tbf-unit-2-part-1-section-3',
                        label: '左上段 復習',
                        seeds: buildTypingSection(
                            ['qwert', 'trewq', 'qweasd', 'werdfg', 'qraf', 'tefd', 'wras', 'ertf'],
                            ['fj', 'jf', 'asdf', 'qwert'],
                            1,
                        ),
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
                        label: 'Y/U/I',
                        seeds: buildTypingSection(
                            ['y', 'u', 'i', 'yu', 'ui', 'iy', 'yui', 'iuy', 'ujik', 'yhju'],
                            ['fj', 'jf', 'jkl;'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-2-part-2-section-2',
                        type: 'tbf-unit-2-part-2-section-2',
                        label: 'O/P + ホーム列',
                        seeds: buildTypingSection(
                            ['o', 'p', 'op', 'po', 'uiop', 'poiu', 'oklp', 'plko', 'uioj', 'iopk'],
                            ['fj', 'jf', 'yui', 'jkl;'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-2-part-2-section-3',
                        type: 'tbf-unit-2-part-2-section-3',
                        label: '右上段 復習',
                        seeds: buildTypingSection(
                            ['yuiop', 'poiuy', 'yuijkl', 'uiojk;', 'yujk', 'iopl', 'uyjk', 'op;j'],
                            ['fj', 'jf', 'jkl;', 'yuiop'],
                            1,
                        ),
                    },
                ],
            },
            {
                id: 'tbf-unit-2-part-3',
                label: '上段+ホーム列 総合',
                pos: 'typing-top-home-mix',
                category: ['typing', 'top-row', 'mix'],
                sections: [
                    {
                        id: 'tbf-unit-2-part-3-section-1',
                        type: 'tbf-unit-2-part-3-section-1',
                        label: '左右交互チャンク',
                        seeds: buildTypingSection(
                            ['qaz', 'wsx', 'edc', 'rfv', 'yhn', 'ujm', 'ik,', 'ol.', 'qas', 'ijn'],
                            ['fj', 'jf', 'qwert', 'yuiop', 'asdf', 'jkl;'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-2-part-3-section-2',
                        type: 'tbf-unit-2-part-3-section-2',
                        label: '短語（上段+ホーム）',
                        seeds: buildTypingSection(
                            ['type', 'tree', 'quiet', 'write', 'rope', 'tire', 'user', 'joke', 'safe', 'file'],
                            ['fj', 'jf', 'asdfjkl;', 'qwertyuiop'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-2-part-3-section-3',
                        type: 'tbf-unit-2-part-3-section-3',
                        label: '上段総合チェック',
                        seeds: buildTypingSection(
                            ['qwerty', 'ytrewq', 'uiopjk', 'asdfwe', 'jkl;io', 'fjweui', 'dkrtop', 'sltyui'],
                            ['fj', 'jf', 'qwert', 'yuiop', 'asdf', 'jkl;'],
                            1,
                        ),
                    },
                ],
            },
        ],
    },
    {
        id: 'tbf-unit-3',
        name: 'Unit 3: 下段導入（ホーム列と反復）',
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
                        label: 'Z/X/C',
                        seeds: buildTypingSection(
                            ['z', 'x', 'c', 'zx', 'xc', 'cz', 'zxc', 'xcz', 'zas', 'xdc'],
                            ['fj', 'jf', 'asdf'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-3-part-1-section-2',
                        type: 'tbf-unit-3-part-1-section-2',
                        label: 'V/B + ホーム列',
                        seeds: buildTypingSection(
                            ['v', 'b', 'vb', 'bv', 'xcvb', 'bvcx', 'vfgb', 'bdfv', 'zvfa', 'bcsd'],
                            ['fj', 'jf', 'zxc', 'asdf'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-3-part-1-section-3',
                        type: 'tbf-unit-3-part-1-section-3',
                        label: '左下段 復習',
                        seeds: buildTypingSection(
                            ['zxcvb', 'bvcxz', 'zxcasd', 'cvbdfg', 'zvca', 'bxdf', 'xcsa', 'vbsd'],
                            ['fj', 'jf', 'zxcvb', 'asdf'],
                            1,
                        ),
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
                        label: 'N/M/,',
                        seeds: buildTypingSection(
                            ['n', 'm', ',', 'nm', 'm,', ',n', 'nm,', ',mn', 'njm', 'mki'],
                            ['fj', 'jf', 'jkl;'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-3-part-2-section-2',
                        type: 'tbf-unit-3-part-2-section-2',
                        label: '. / + ホーム列',
                        seeds: buildTypingSection(
                            ['.', '/', './', '/.', 'm,./', '/.,m', 'jkl.', ';l,/', 'n.mj', 'm,/k'],
                            ['fj', 'jf', 'nm,', 'jkl;'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-3-part-2-section-3',
                        type: 'tbf-unit-3-part-2-section-3',
                        label: '右下段 復習',
                        seeds: buildTypingSection(
                            ['nm,./', '/.,mn', 'nm,jkl', ',./;lk', 'n,mj', 'm./k', ',n;j', '/.lk'],
                            ['fj', 'jf', 'nm,./', 'jkl;'],
                            1,
                        ),
                    },
                ],
            },
            {
                id: 'tbf-unit-3-part-3',
                label: '下段+ホーム列 総合',
                pos: 'typing-bottom-home-mix',
                category: ['typing', 'bottom-row', 'mix'],
                sections: [
                    {
                        id: 'tbf-unit-3-part-3-section-1',
                        type: 'tbf-unit-3-part-3-section-1',
                        label: '左右交互チャンク',
                        seeds: buildTypingSection(
                            ['zmx', 'cvn', 'bjm', 'nfa', 'vjk', 'xsl', 'c;d', 'b/a', 'zvbn', 'nmbv'],
                            ['fj', 'jf', 'zxcvb', 'nm,./', 'asdf', 'jkl;'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-3-part-3-section-2',
                        type: 'tbf-unit-3-part-3-section-2',
                        label: '短語（下段+ホーム）',
                        seeds: buildTypingSection(
                            ['mix', 'calm', 'mask', 'sand', 'land', 'milk', 'jump', 'back', 'slam', 'jam'],
                            ['fj', 'jf', 'asdfjkl;', 'zxcvbnm'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-3-part-3-section-3',
                        type: 'tbf-unit-3-part-3-section-3',
                        label: '下段総合チェック',
                        seeds: buildTypingSection(
                            ['zxcvbn', 'nbvcxz', 'nm,./j', 'asdfcv', 'jkl;nm', 'fjzmn/', 'dkcvm,', 'slxbn.'],
                            ['fj', 'jf', 'zxcvb', 'nm,./', 'asdf', 'jkl;'],
                            1,
                        ),
                    },
                ],
            },
        ],
    },
    {
        id: 'tbf-unit-4',
        name: 'Unit 4: 統合復習と大文字',
        parts: [
            {
                id: 'tbf-unit-4-part-1',
                label: '頻出短語（反復）',
                pos: 'typing-review-words',
                category: ['typing', 'word', 'review'],
                sections: [
                    {
                        id: 'tbf-unit-4-part-1-section-1',
                        type: 'tbf-unit-4-part-1-section-1',
                        label: '3-5文字語',
                        seeds: buildTypingSection(
                            ['cat', 'dog', 'sun', 'hand', 'jump', 'ask', 'milk', 'land', 'fast', 'quiet'],
                            ['fj', 'jf', 'asdf', 'jkl;', 'qwert', 'zxcvb'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-4-part-1-section-2',
                        type: 'tbf-unit-4-part-1-section-2',
                        label: '弱点パターン復習',
                        seeds: buildTypingSection(
                            ['fjdk', 'sl;a', 'qazwsx', 'okmijn', 'zmxn', 'pl;.', 'rfv', 'ujm', 'cvb', 'nm,'],
                            ['fj', 'jf', 'dk', 'sl', 'a;', 'asdfjkl;'],
                            1,
                        ),
                    },
                ],
            },
            {
                id: 'tbf-unit-4-part-2',
                label: '左右交互チャレンジ',
                pos: 'typing-review-alternate',
                category: ['typing', 'pattern', 'alternate'],
                sections: [
                    {
                        id: 'tbf-unit-4-part-2-section-1',
                        type: 'tbf-unit-4-part-2-section-1',
                        label: '交互パターン',
                        seeds: buildTypingSection(
                            ['fa', 'jo', 'deki', 'sul;', 'fghj', 'qazplm', 'wsxokn', 'edcijn', 'rtvuhm', 'tybn'],
                            ['fj', 'jf', 'asdf', 'jkl;', 'qwerty', 'zxcvbn'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-4-part-2-section-2',
                        type: 'tbf-unit-4-part-2-section-2',
                        label: 'テンポ維持反復',
                        seeds: buildTypingSection(
                            ['fjfj', 'dkdk', 'slsl', 'a;a;', 'qwqw', 'uiui', 'zxzx', 'nmnm', 'fjdksl', 'a;lk'],
                            ['fj', 'jf', 'asdfjkl;', 'qwertyui', 'zxcvbnm'],
                            1,
                        ),
                    },
                ],
            },
            {
                id: 'tbf-unit-4-part-3',
                label: 'Shiftで大文字',
                pos: 'typing-review-uppercase',
                category: ['typing', 'uppercase', 'review'],
                sections: [
                    {
                        id: 'tbf-unit-4-part-3-section-1',
                        type: 'tbf-unit-4-part-3-section-1',
                        label: '先頭大文字',
                        seeds: buildTypingSection(
                            ['Cat', 'Dog', 'Sun', 'Fast', 'Jump', 'Mask', 'Quiet', 'Land'],
                            ['fj', 'jf', 'type', 'milk'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-4-part-3-section-2',
                        type: 'tbf-unit-4-part-3-section-2',
                        label: '大文字混在',
                        seeds: buildTypingSection(
                            ['Fj', 'DfJk', 'AsDf', 'QwEr', 'TyUi', 'ZxCv', 'Nm,.', 'FlAsK'],
                            ['fj', 'jf', 'asdfjkl;', 'qwertyuiop'],
                            1,
                        ),
                    },
                    {
                        id: 'tbf-unit-4-part-3-section-3',
                        type: 'tbf-unit-4-part-3-section-3',
                        label: '総合チェック',
                        seeds: buildTypingSection(
                            ['Fast', 'Quiet', 'Jump', 'Mask', 'Type', 'Land', 'Milk', 'FjDkSl', 'AsDfJkL;', 'QweRty'],
                            ['fj', 'jf', 'asdf', 'jkl;', 'qwert', 'zxcvb', 'nm,./'],
                            1,
                        ),
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
