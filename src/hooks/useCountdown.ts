// ================================
// Countdown Hook
// ================================

import { useCallback, useEffect, useState } from 'react';

export function useCountdown(
    initialValue = 3,
    onTick?: () => void
) {
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isCountingDown, setIsCountingDown] = useState(false);

    const start = useCallback((value = initialValue) => {
        setCountdown(value);
        setIsCountingDown(true);
    }, [initialValue]);

    useEffect(() => {
        if (!isCountingDown || countdown === null) return;
        onTick?.();
        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev === null) return null;
                if (prev <= 1) return null;
                onTick?.();
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isCountingDown, countdown, onTick]);

    useEffect(() => {
        if (!isCountingDown || countdown !== null) return;
        const timer = setTimeout(() => {
            setIsCountingDown(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [isCountingDown, countdown]);

    return { countdown, isCountingDown, start };
}
