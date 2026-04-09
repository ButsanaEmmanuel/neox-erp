
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'canceled';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;

    // Dates
    dueAt: string; // ISO string
    reminderAt?: string; // ISO string
    completedAt?: string; // ISO string
    createdAt: string; // ISO string
    updatedAt: string; // ISO string

    // Ownership
    ownerId: string; // User ID
    createdById: string; // User ID

    // Relationships (at least one is usually present)
    dealId?: string;
    personId?: string;
    companyId?: string;

    // Metadata
    tags: string[];
}

export interface CreateTaskPayload {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueAt: string;
    reminderAt?: string;
    ownerId: string;
    dealId?: string;
    personId?: string;
    companyId?: string;
    tags?: string[];
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {
    id: string;
    completedAt?: string;
}
