// ================================
// Confetti Component
// ================================

interface ConfettiProps {
    count?: number;
    colors?: string[];
    wrapperClassName: string;
    itemClassName: string;
}

export function Confetti({
    count = 24,
    colors = ['#FFC107', '#2196F3', '#4CAF50', '#E91E63'],
    wrapperClassName,
    itemClassName,
}: ConfettiProps) {
    return (
        <div className={wrapperClassName} aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => {
                const left = `${Math.random() * 100}%`;
                const delay = `${Math.random() * 2}s`;
                const duration = `${2 + Math.random() * 3}s`;
                return (
                    <span
                        key={i}
                        className={itemClassName}
                        style={{
                            left,
                            backgroundColor: colors[i % colors.length],
                            animationDelay: delay,
                            animationDuration: duration,
                        }}
                    />
                );
            })}
        </div>
    );
}

export default Confetti;
