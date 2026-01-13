// ================================
// Sample Question Data
// New Horizon 1 - Unit 6 サンプル
// ================================

import { Question, Course, PageRange, Section } from '@/types';

// 問題データ
export const questions: Question[] = [
    // p30-31 小学校の単語
    {
        id: 'q1',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'elementary_words',
        sectionLabel: '小学校の単語',
        promptJp: 'セブ（地名）',
        answerEn: 'Cebu',
        orderIndex: 1,
    },
    {
        id: 'q2',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'elementary_words',
        sectionLabel: '小学校の単語',
        promptJp: '友達',
        answerEn: 'friend',
        orderIndex: 2,
    },
    {
        id: 'q3',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'elementary_words',
        sectionLabel: '小学校の単語',
        promptJp: '学校',
        answerEn: 'school',
        orderIndex: 3,
    },
    {
        id: 'q4',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'elementary_words',
        sectionLabel: '小学校の単語',
        promptJp: '先生',
        answerEn: 'teacher',
        orderIndex: 4,
    },
    {
        id: 'q5',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'elementary_words',
        sectionLabel: '小学校の単語',
        promptJp: '生徒',
        answerEn: 'student',
        orderIndex: 5,
    },
    {
        id: 'q6',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'elementary_words',
        sectionLabel: '小学校の単語',
        promptJp: '本',
        answerEn: 'book',
        orderIndex: 6,
    },

    // p30-31 New Words
    {
        id: 'q7',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '勝つ',
        answerEn: 'win',
        orderIndex: 1,
    },
    {
        id: 'q8',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '試合',
        answerEn: 'game',
        orderIndex: 2,
    },
    {
        id: 'q9',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '〜したい',
        answerEn: 'want',
        orderIndex: 3,
    },
    {
        id: 'q10',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '練習する',
        answerEn: 'practice',
        orderIndex: 4,
    },
    {
        id: 'q11',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '一生懸命に',
        answerEn: 'hard',
        orderIndex: 5,
    },
    {
        id: 'q12',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '毎日',
        answerEn: 'every day',
        orderIndex: 6,
    },

    // p30-31 Key Sentences
    {
        id: 'q13',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'key_sentences',
        sectionLabel: 'キーセンテンス',
        promptJp: '私は試合に勝ちたいです。',
        answerEn: 'I want to win the game.',
        highlightTokens: ['win'],
        orderIndex: 1,
    },
    {
        id: 'q14',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'key_sentences',
        sectionLabel: 'キーセンテンス',
        promptJp: '彼女は英語を勉強したいです。',
        answerEn: 'She wants to study English.',
        highlightTokens: ['study'],
        orderIndex: 2,
    },
    {
        id: 'q15',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'key_sentences',
        sectionLabel: 'キーセンテンス',
        promptJp: '私たちは一緒にサッカーをしたいです。',
        answerEn: 'We want to play soccer together.',
        highlightTokens: ['play'],
        orderIndex: 3,
    },
    {
        id: 'q16',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'key_sentences',
        sectionLabel: 'キーセンテンス',
        promptJp: '彼は医者になりたいです。',
        answerEn: 'He wants to be a doctor.',
        highlightTokens: ['be'],
        orderIndex: 4,
    },

    // p30-31 まとめ
    {
        id: 'q17',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'summary',
        sectionLabel: 'まとめ',
        promptJp: '私は音楽を聴きたいです。',
        answerEn: 'I want to listen to music.',
        orderIndex: 1,
    },
    {
        id: 'q18',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p30-31',
        section: 'summary',
        sectionLabel: 'まとめ',
        promptJp: '彼女は本を読みたいです。',
        answerEn: 'She wants to read a book.',
        orderIndex: 2,
    },

    // p32-33 New Words
    {
        id: 'q19',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p32-33',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '訪問する',
        answerEn: 'visit',
        orderIndex: 1,
    },
    {
        id: 'q20',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p32-33',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '国',
        answerEn: 'country',
        orderIndex: 2,
    },
    {
        id: 'q21',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p32-33',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '美しい',
        answerEn: 'beautiful',
        orderIndex: 3,
    },
    {
        id: 'q22',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p32-33',
        section: 'new_words',
        sectionLabel: 'New Words',
        promptJp: '場所',
        answerEn: 'place',
        orderIndex: 4,
    },

    // p32-33 Key Sentences
    {
        id: 'q23',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p32-33',
        section: 'key_sentences',
        sectionLabel: 'キーセンテンス',
        promptJp: '私は日本を訪れたいです。',
        answerEn: 'I want to visit Japan.',
        highlightTokens: ['visit'],
        orderIndex: 1,
    },
    {
        id: 'q24',
        course: 'New Horizon 1',
        unit: 'Unit 6',
        pageRange: 'p32-33',
        section: 'key_sentences',
        sectionLabel: 'キーセンテンス',
        promptJp: '彼は美しい場所を見たいです。',
        answerEn: 'He wants to see beautiful places.',
        highlightTokens: ['see'],
        orderIndex: 2,
    },
];

// コース構造データ
export const courseStructure: Course = {
    id: 'nh1',
    name: 'New Horizon 1',
    units: [
        {
            id: 'unit6',
            name: 'Unit 6',
            pages: [
                {
                    id: 'p30-31',
                    range: 'p30-31',
                    totalQuestions: 18,
                    sections: [
                        {
                            id: 'p30-31-elementary',
                            type: 'elementary_words',
                            label: '小学校の単語',
                            questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
                        },
                        {
                            id: 'p30-31-new',
                            type: 'new_words',
                            label: 'New Words',
                            questionIds: ['q7', 'q8', 'q9', 'q10', 'q11', 'q12'],
                        },
                        {
                            id: 'p30-31-key',
                            type: 'key_sentences',
                            label: 'キーセンテンス',
                            questionIds: ['q13', 'q14', 'q15', 'q16'],
                        },
                        {
                            id: 'p30-31-summary',
                            type: 'summary',
                            label: 'まとめ',
                            questionIds: ['q17', 'q18'],
                        },
                    ],
                },
                {
                    id: 'p32-33',
                    range: 'p32-33',
                    totalQuestions: 6,
                    sections: [
                        {
                            id: 'p32-33-new',
                            type: 'new_words',
                            label: 'New Words',
                            questionIds: ['q19', 'q20', 'q21', 'q22'],
                        },
                        {
                            id: 'p32-33-key',
                            type: 'key_sentences',
                            label: 'キーセンテンス',
                            questionIds: ['q23', 'q24'],
                        },
                    ],
                },
                {
                    id: 'p34-35',
                    range: 'p34-35',
                    totalQuestions: 0,
                    sections: [],
                },
                {
                    id: 'p36-37',
                    range: 'p36-37',
                    totalQuestions: 0,
                    sections: [],
                },
                {
                    id: 'p38',
                    range: 'p38',
                    totalQuestions: 0,
                    sections: [],
                },
            ],
        },
    ],
};

// Helper functions
export function getQuestionById(id: string): Question | undefined {
    return questions.find(q => q.id === id);
}

export function getQuestionsBySection(pageRange: string, sectionType: string): Question[] {
    return questions.filter(q => q.pageRange === pageRange && q.section === sectionType);
}

export function getPageRanges(): PageRange[] {
    return courseStructure.units.flatMap(unit => unit.pages);
}

export function getSectionsByPageRange(pageRangeId: string): Section[] {
    const page = getPageRanges().find(p => p.id === pageRangeId);
    return page?.sections || [];
}
