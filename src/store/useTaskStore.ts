import { create } from 'zustand';
import { Task, CreateTaskPayload, UpdateTaskPayload } from '../types/task';
import { v4 as uuidv4 } from 'uuid';

interface TaskState {
    tasks: Task[];
    isLoading: boolean;
    error: string | null;

    // Actions
    addTask: (payload: CreateTaskPayload) => void;
    updateTask: (payload: UpdateTaskPayload) => void;
    completeTask: (id: string) => void;
    deleteTask: (id: string) => void;

    // Pre-computed Selectors (can also be done in component)
    getTasksByOwner: (ownerId: string) => Task[];
    getTasksByDeal: (dealId: string) => Task[];
}

const INITIAL_TASKS: Task[] = [];

export const useTaskStore = create<TaskState>((set, get) => ({
    tasks: INITIAL_TASKS,
    isLoading: false,
    error: null,

    addTask: (payload) => {
        const newTask: Task = {
            id: uuidv4(),
            ...payload,
            status: payload.status || 'todo',
            priority: payload.priority || 'medium',
            tags: payload.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownerId: payload.ownerId || 'user-1', // Default to current user
            createdById: 'user-1' // Default to current user
        };

        set((state) => ({
            tasks: [newTask, ...state.tasks]
        }));
    },

    updateTask: (payload) => {
        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === payload.id
                    ? { ...task, ...payload, updatedAt: new Date().toISOString() }
                    : task
            )
        }));
    },

    completeTask: (id) => {
        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === id
                    ? {
                        ...task,
                        status: 'done',
                        completedAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                    : task
            )
        }));
    },

    deleteTask: (id) => {
        set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== id)
        }));
    },

    getTasksByOwner: (ownerId) => {
        return get().tasks.filter((task) => task.ownerId === ownerId);
    },

    getTasksByDeal: (dealId) => {
        return get().tasks.filter((task) => task.dealId === dealId);
    }
}));
