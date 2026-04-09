import { create } from 'zustand';
import { apiRequest } from '../../lib/apiClient';

export interface CrmClient {
    id: string;
    name: string;
    industry?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    billingAddress?: string;
    country?: string;
    taxRegistrationNumber?: string;
    notes?: string;
    ownerId?: string;
    tags?: string[];
    profileStatus?: 'complete' | 'needs_completion' | 'draft_client';
    updatedAt?: string;
    createdAt?: string;
}

interface CrmStore {
    clients: CrmClient[];
    loading: boolean;
    error: string | null;
    fetchClients: (query?: string) => Promise<CrmClient[]>;
    searchClients: (query: string) => CrmClient[];
    createClientInline: (payload: {
        name: string;
        industry?: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
        billingAddress?: string;
        country?: string;
        taxRegistrationNumber?: string;
        notes?: string;
        ownerId?: string;
        tags?: string[];
    }) => Promise<CrmClient>;
    suggestClientDuplicates: (probe: { name: string; email?: string; taxRegistrationNumber?: string }) => CrmClient[];
    getClientById: (id: string) => CrmClient | undefined;
}

function normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const useCrmStore = create<CrmStore>((set, get) => ({
    clients: [],
    loading: false,
    error: null,

    fetchClients: async (query = '') => {
        set({ loading: true, error: null });
        try {
            const data = await apiRequest<{ clients: CrmClient[] }>(`/api/v1/crm/clients?q=${encodeURIComponent(query)}&take=300`);
            set({ clients: data.clients || [], loading: false });
            return data.clients || [];
        } catch (error) {
            set({ loading: false, error: error instanceof Error ? error.message : 'Unable to fetch CRM clients' });
            return get().clients;
        }
    },

    searchClients: (query) => {
        const { clients } = get();
        if (!query) return clients;
        const lowerQuery = query.toLowerCase();
        return clients.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.industry?.toLowerCase().includes(lowerQuery) ||
            c.email?.toLowerCase().includes(lowerQuery)
        );
    },

    suggestClientDuplicates: ({ name, email, taxRegistrationNumber }) => {
        const trimmed = String(name || '').trim();
        const normalized = normalizeName(trimmed);
        return get().clients.filter((client) => {
            const clientNormalized = normalizeName(client.name || '');
            const exactName = client.name.toLowerCase() === trimmed.toLowerCase();
            const normalizedMatch = normalized.length >= 4 && clientNormalized.includes(normalized);
            const emailMatch = Boolean(email && client.email && client.email.toLowerCase() === email.toLowerCase());
            const taxMatch = Boolean(taxRegistrationNumber && client.taxRegistrationNumber && client.taxRegistrationNumber === taxRegistrationNumber);
            return exactName || normalizedMatch || emailMatch || taxMatch;
        });
    },

    createClientInline: async (payload) => {
        const trimmedName = (payload.name || '').trim();
        if (!trimmedName) throw new Error('Client name is required.');

        const created = await apiRequest<{ client: CrmClient }>('/api/v1/crm/clients', {
            method: 'POST',
            body: {
                ...payload,
                name: trimmedName,
                profileStatus: 'needs_completion',
            },
        });

        set((state) => ({ clients: [created.client, ...state.clients.filter((c) => c.id !== created.client.id)] }));
        return created.client;
    },

    getClientById: (id) => get().clients.find((client) => client.id === id),
}));
