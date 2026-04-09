import { Stage } from '../constants/crm';

export interface PersonReference {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    initials: string;
}

export interface CompanyReference {
    id: string;
    name: string;
    initials: string;
}

export interface DealPerson {
    personId: string;
    person: PersonReference;
    role: string;  // "Primary Contact", "Decision Maker", "Influencer", etc.
    isPrimary: boolean;
    addedAt: string;
}

export interface Deal {
    id: string;
    name: string;

    // Company relationship (required)
    companyId: string;
    company: CompanyReference;  // Denormalized for display

    // People relationships
    primaryContactId?: string;
    primaryContact?: PersonReference;  // Denormalized
    stakeholders: DealPerson[];  // All people related to deal

    // Pipeline fields
    initials: string; // Company initials for avatar (kept for backward compatibility)
    stage: Stage;
    value: string; // Formatted display value like "$250k"
    numericValue: number; // Raw numeric value for calculations
    currency: string;
    owner: string;
    probability: string; // Formatted like "75%"
    probabilityValue: number; // Raw numeric probability 0-100
    lastActivity: string; // Like "2h ago"
    closeDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateDealPayload {
    name: string;
    companyId: string;  // Required
    primaryContactId?: string;  // Optional
    stakeholderIds?: string[];  // Optional additional people
    stakeholderRoles?: Record<string, string>;  // personId -> role mapping
    stage: Stage;
    stageRefId?: string;
    value: number; // Raw numeric input
    currency?: string;
    owner?: string;
    ownerUserId?: string;
    closeDate?: string;
    notes?: string;
}

export interface UpdateDealPayload extends Partial<CreateDealPayload> {
    id: string;
}
