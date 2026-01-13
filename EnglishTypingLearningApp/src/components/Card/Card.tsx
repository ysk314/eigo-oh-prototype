// ================================
// Card Component
// ================================

import React from 'react';
import styles from './Card.module.css';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    onClick?: () => void;
    hoverable?: boolean;
}

export function Card({
    children,
    className = '',
    variant = 'default',
    padding = 'md',
    onClick,
    hoverable = false,
}: CardProps) {
    const cardClass = [
        styles.card,
        styles[variant],
        styles[`padding-${padding}`],
        hoverable || onClick ? styles.hoverable : '',
        onClick ? styles.clickable : '',
        className,
    ].filter(Boolean).join(' ');

    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            className={cardClass}
            onClick={onClick}
            type={onClick ? 'button' : undefined}
        >
            {children}
        </Component>
    );
}

export default Card;
