import { Stage } from '../constants/crm';

export interface Person {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    initials: string;

    // Company affiliation
    primaryCompanyId?: string;
    primaryCompany?: CompanyReference;

    // For future multi-company support
    companies?: PersonCompany[];

    stage: Stage;
    createdAt: string;
    updatedAt: string;
}

export interface PersonCompany {
    companyId: string;
    company: CompanyReference;
    title?: string;
    isPrimary: boolean;
}

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

export interface CreatePersonPayload {
    name: string;
    email: string;
    phone?: string;
    primaryCompanyId?: string;
    stage?: Stage;
}

export interface UpdatePersonPayload extends Partial<CreatePersonPayload> {
    id: string;
}
