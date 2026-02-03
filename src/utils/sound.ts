// ================================
// Sound Effects Utilities
// ================================

export type SoundType =
    | 'type'
    | 'error'
    | 'success'
    | 'fanfare'
    | 'try-again'
    | 'countdown';

interface SoundContext {
    ctx: AudioContext | null;
}

const soundContext: SoundContext = {
    ctx: null,
};

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!soundContext.ctx) {
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
            try {
                soundContext.ctx = new Ctx();
            } catch (error) {
                console.warn('Failed to initialize AudioContext:', error);
                return null;
            }
        }
    }
    return soundContext.ctx;
}

export function playSound(type: SoundType): void {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => undefined);
        }

        const now = ctx.currentTime;

        if (type === 'type') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            return;
        }

        if (type === 'error') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.15);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            return;
        }

        if (type === 'fanfare') {
            const notes = [523.25, 659.25, 783.99, 1046.5];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, now + i * 0.1);
                gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.6);
            });
            return;
        }

        if (type === 'success') {
            const notes = [523.25, 659.25];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, now + i * 0.15);
                gain.gain.linearRampToValueAtTime(0.2, now + i * 0.15 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.5);
            });
            return;
        }

        if (type === 'try-again') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            return;
        }

        if (type === 'countdown') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    } catch (error) {
        console.warn('Failed to play sound:', error);
    }
}
