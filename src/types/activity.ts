
export type ActivityType =
    | 'note'
    | 'call'
    | 'email'
    | 'meeting'
    | 'task_created'
    | 'task_completed'
    | 'status_change';

export interface Activity {
    id: string;
    type: ActivityType;
    body: string; // Rich text or markdown
    timestamp: string; // ISO string

    // Actor
    actorId: string; // User ID who performed the activity

    // Relationships
    dealId?: string;
    personId?: string;
    companyId?: string;
    taskId?: string; // If related to a specific task

    // Metadata
    metadata?: {
        duration?: number; // seconds (for calls/meetings)
        outcome?: string; // e.g., "Connected", "Left Voicemail"
        externalId?: string; // e.g., Email ID
        location?: string; // e.g., "Zoom", "Office"
        [key: string]: any;
    };

    createdAt: string;
}

export interface ActivityTypeConfig {
    id: ActivityType;
    label: string;
    icon: string; // Lucide icon name
    color: string; // Tailwind color class or hex
    enabled: boolean;
}

export interface CreateActivityPayload {
    type: ActivityType;
    body: string;
    dealId?: string;
    personId?: string;
    companyId?: string;
    taskId?: string;
    metadata?: Activity['metadata'];
    timestamp?: string; // Defaults to now if omitted
}
