import type { Course, Question } from '@/types';

type Seed = {
    promptJp: string;
    answerEn: string;
    pos: string[];
    category?: string[];
};

type PartDef = {
    id: string;
    label: string;
    sectionId: string;
    sectionLabel: string;
    seeds: Seed[];
};

const courseName = 'TOEIC Starter';
const unitId = 'toeic-starter-unit-1';
const unitName = 'Unit 1: TOEIC基礎トレーニング';

const parts: PartDef[] = [
    {
        id: 'toeic-starter-part-1',
        label: 'Part 1: ビジネス基礎語彙',
        sectionId: 'toeic-starter-part-1-section-1',
        sectionLabel: '頻出単語',
        seeds: [
            { promptJp: '予約', answerEn: 'reservation', pos: ['noun'] },
            { promptJp: '請求書', answerEn: 'invoice', pos: ['noun'] },
            { promptJp: '締め切り', answerEn: 'deadline', pos: ['noun'] },
            { promptJp: '提出する', answerEn: 'submit', pos: ['verb'] },
            { promptJp: '確認する', answerEn: 'confirm', pos: ['verb'] },
            { promptJp: '延期する', answerEn: 'postpone', pos: ['verb'] },
            { promptJp: '予算', answerEn: 'budget', pos: ['noun'] },
            { promptJp: '見積もり', answerEn: 'estimate', pos: ['noun'] },
            { promptJp: '在庫', answerEn: 'inventory', pos: ['noun'] },
            { promptJp: '配送', answerEn: 'delivery', pos: ['noun'] },
        ],
    },
    {
        id: 'toeic-starter-part-2',
        label: 'Part 2: メール・会議表現',
        sectionId: 'toeic-starter-part-2-section-1',
        sectionLabel: '実務フレーズ',
        seeds: [
            { promptJp: '添付ファイルをご確認ください。', answerEn: 'Please find the attached file.', pos: ['sentence'], category: ['sentence'] },
            { promptJp: '会議は3時に始まります。', answerEn: 'The meeting starts at three.', pos: ['sentence'], category: ['sentence'] },
            { promptJp: '予定を変更できますか。', answerEn: 'Could you change the schedule?', pos: ['sentence'], category: ['sentence'] },
            { promptJp: '詳細を共有していただけますか。', answerEn: 'Could you share the details?', pos: ['sentence'], category: ['sentence'] },
            { promptJp: 'ご返信ありがとうございます。', answerEn: 'Thank you for your reply.', pos: ['sentence'], category: ['sentence'] },
            { promptJp: '資料を更新しました。', answerEn: 'I updated the document.', pos: ['sentence'], category: ['sentence'] },
            { promptJp: '本日中に連絡します。', answerEn: 'I will contact you today.', pos: ['sentence'], category: ['sentence'] },
            { promptJp: 'それは良い提案ですね。', answerEn: 'That is a good suggestion.', pos: ['sentence'], category: ['sentence'] },
            { promptJp: '少々お待ちください。', answerEn: 'Please wait a moment.', pos: ['sentence'], category: ['sentence'] },
            { promptJp: 'こちらが最終版です。', answerEn: 'This is the final version.', pos: ['sentence'], category: ['sentence'] },
        ],
    },
    {
        id: 'toeic-starter-part-3',
        label: 'Part 3: 出張・オフィス語彙',
        sectionId: 'toeic-starter-part-3-section-1',
        sectionLabel: '場面別単語',
        seeds: [
            { promptJp: '搭乗券', answerEn: 'boarding pass', pos: ['noun'] },
            { promptJp: '受付', answerEn: 'reception', pos: ['noun'] },
            { promptJp: '顧客', answerEn: 'client', pos: ['noun'] },
            { promptJp: '支店', answerEn: 'branch', pos: ['noun'] },
            { promptJp: '設備', answerEn: 'facility', pos: ['noun'] },
            { promptJp: '契約', answerEn: 'contract', pos: ['noun'] },
            { promptJp: '申請する', answerEn: 'apply', pos: ['verb'] },
            { promptJp: '修理する', answerEn: 'repair', pos: ['verb'] },
            { promptJp: '通知', answerEn: 'notification', pos: ['noun'] },
            { promptJp: '実施する', answerEn: 'conduct', pos: ['verb'] },
        ],
    },
];

export const questions: Question[] = parts.flatMap((part) =>
    part.seeds.map((seed, index) => ({
        id: `toeic-starter-q${String(index + 1).padStart(2, '0')}-${part.id}`,
        course: courseName,
        unit: unitName,
        partId: part.id,
        section: part.sectionId,
        sectionLabel: part.sectionLabel,
        promptJp: seed.promptJp,
        answerEn: seed.answerEn,
        pos: seed.pos,
        category: seed.category,
        orderIndex: index + 1,
    }))
);

export const courseStructure: Course = {
    id: 'course-toeic-starter',
    name: courseName,
    units: [
        {
            id: unitId,
            name: unitName,
            parts: parts.map((part) => ({
                id: part.id,
                label: part.label,
                totalQuestions: part.seeds.length,
                sections: [
                    {
                        id: part.sectionId,
                        type: part.sectionId,
                        label: part.sectionLabel,
                        questionIds: questions
                            .filter((question) => question.partId === part.id)
                            .map((question) => question.id),
                    },
                ],
            })),
        },
    ],
};
