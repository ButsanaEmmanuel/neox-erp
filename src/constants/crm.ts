export const STAGE_COLORS = {
    Discovery: '#2F6BFF',   // Blue
    Qualified: '#8B5CF6',   // Violet
    Proposal: '#F59E0B',    // Amber
    Negotiation: '#F97316', // Orange
    Closing: '#10B981',     // Emerald
} as const;

export type Stage = keyof typeof STAGE_COLORS;

/**
 * Helper to convert hex to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`
        : hex;
}

export function getStageColor(stage: string): string {
    return STAGE_COLORS[stage as Stage] || '#94a3b8'; // Default slate-400
}

export function getStageBadgeStyles(stage: string) {
    const color = getStageColor(stage);
    return {
        color: color,
        backgroundColor: hexToRgba(color, 0.16), // ~16% opacity
        borderColor: hexToRgba(color, 0.4),      // ~40% opacity
        borderWidth: '1px',
        borderStyle: 'solid',
    };
}

export function getStageBarFill(stage: string): string {
    return getStageColor(stage);
}

export const CONTACT_STAGES = ['Discovery', 'Qualified', 'Proposal', 'Negotiation', 'Closing'];
