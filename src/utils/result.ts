// ================================
// Result Utilities
// ================================

import type { Rank } from '@/types';

export function getRankMessage(rank: Rank): string {
    switch (rank) {
        case 'S':
            return '素晴らしい！次のセクションに進もう！';
        case 'A':
            return 'あと一歩！もう一度でSに届きそう！';
        case 'B':
            return 'いい調子！ミスを減らせばSも見えるよ';
        case 'C':
        default:
            return 'まずは正確さ重視。ゆっくりでOK！';
    }
}
