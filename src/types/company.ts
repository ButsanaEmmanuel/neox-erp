export interface Company {
    id: string;
    name: string;
    initials: string;
    domain?: string;
    industry?: string;
    size?: string;
    address?: string;
    email?: string;
    phone?: string;
    contactPerson?: string;
    ownerUserId?: string;

    // Stats (computed)
    dealCount?: number;
    peopleCount?: number;
    totalValue?: number;

    createdAt: string;
    updatedAt: string;
}

export interface CreateCompanyPayload {
    name: string;
    domain?: string;
    industry?: string;
    industryRefId?: string;
    ownerUserId?: string;
    size?: string;
    address?: string;
}

export interface UpdateCompanyPayload extends Partial<CreateCompanyPayload> {
    id: string;
    email?: string;
    phone?: string;
    contactPerson?: string;
    billingAddress?: string;
    ownerUserId?: string;
}
