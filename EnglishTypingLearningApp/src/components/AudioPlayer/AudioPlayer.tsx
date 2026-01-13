// ================================
// Audio Player Component
// ================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './AudioPlayer.module.css';

interface AudioPlayerProps {
    text: string;
    audioUrl?: string;
    disabled?: boolean;
    autoPlay?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function AudioPlayer({
    text,
    audioUrl,
    disabled = false,
    autoPlay = false,
    size = 'md',
}: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

    const play = useCallback(() => {
        if (disabled) return;

        // 既存の再生を停止
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        window.speechSynthesis.cancel();

        setIsPlaying(true);

        if (audioUrl) {
            // 音声ファイルを再生
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => {
                // フォールバック: TTSを使用
                playTTS();
            };

            audio.play().catch(() => {
                playTTS();
            });
        } else {
            // TTSを使用
            playTTS();
        }
    }, [audioUrl, text, disabled]);

    const playTTS = useCallback(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1;

        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);

        synthRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [text]);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    }, []);

    // 自動再生
    useEffect(() => {
        if (autoPlay && !disabled) {
            const timer = setTimeout(() => play(), 300);
            return () => clearTimeout(timer);
        }
    }, [autoPlay, disabled, text]);

    // クリーンアップ
    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    const buttonClass = [
        styles.button,
        styles[size],
        isPlaying ? styles.playing : '',
        disabled ? styles.disabled : '',
    ].filter(Boolean).join(' ');

    return (
        <button
            className={buttonClass}
            onClick={isPlaying ? stop : play}
            disabled={disabled}
            aria-label={isPlaying ? '停止' : '再生'}
        >
            {isPlaying ? (
                <div className={styles.waves}>
                    <span className={styles.wave} />
                    <span className={styles.wave} />
                    <span className={styles.wave} />
                </div>
            ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon}>
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
            )}
        </button>
    );
}

export default AudioPlayer;
