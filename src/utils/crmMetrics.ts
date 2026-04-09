import { Stage, STAGE_COLORS } from '../constants/crm';

/**
 * Calculate deal age in days
 */
export function calculateDealAge(createdAt: string): number {
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

/**
 * Format deal value as currency string
 */
export function formatDealValue(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${Math.round(value / 1000)}k`;
    return `$${value}`;
}

/**
 * Get consistent stage badge styles
 */
export function getStageBadgeStyles(stage: Stage) {
    const color = STAGE_COLORS[stage];
    return {
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`
    };
}

/**
 * Format time ago string
 */
export function formatTimeAgo(timestamp: string): string {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}
