import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Company, CreateCompanyPayload, UpdateCompanyPayload } from '../types/company';
import { apiRequest } from '../lib/apiClient';

interface CompaniesContextType {
  companies: Company[];
  loading: boolean;
  getCompany: (id: string) => Company | undefined;
  refreshCompanies: (query?: string) => Promise<void>;
  createCompany: (payload: CreateCompanyPayload) => Promise<Company>;
  updateCompany: (payload: UpdateCompanyPayload) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
}

interface ClientAccountDto {
  id: string;
  name: string;
  industry?: string | null;
  billingAddress?: string | null;
  email?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  ownerUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

const CompaniesContext = createContext<CompaniesContextType | undefined>(undefined);

const getCompanyInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'NA';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 2);
};

function toCompany(dto: ClientAccountDto): Company {
  return {
    id: dto.id,
    name: dto.name,
    initials: getCompanyInitials(dto.name),
    industry: dto.industry || undefined,
    address: dto.billingAddress || undefined,
    email: dto.email || undefined,
    phone: dto.phone || undefined,
    contactPerson: dto.contactPerson || undefined,
    ownerUserId: dto.ownerUserId || undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const CompaniesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCompanies = async (query = '') => {
    setLoading(true);
    try {
      const data = await apiRequest<{ clients: ClientAccountDto[] }>(`/api/v1/crm/clients?q=${encodeURIComponent(query)}&take=300`);
      setCompanies((data.clients || []).map(toCompany));
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshCompanies();
  }, []);

  const getCompany = (id: string): Company | undefined => companies.find((c) => c.id === id);

  const createCompany = async (payload: CreateCompanyPayload): Promise<Company> => {
    const created = await apiRequest<{ client: ClientAccountDto }>('/api/v1/crm/clients', {
      method: 'POST',
      body: {
        name: payload.name,
        industry: payload.industry,
        industryRefId: payload.industryRefId || null,
        ownerUserId: payload.ownerUserId || null,
        billingAddress: payload.address,
      },
    });
    const mapped = toCompany(created.client);
    setCompanies((prev) => [mapped, ...prev.filter((c) => c.id !== mapped.id)]);
    return mapped;
  };

  const updateCompany = async (payload: UpdateCompanyPayload): Promise<void> => {
    const updated = await apiRequest<{ client: ClientAccountDto }>(`/api/v1/crm/clients/${payload.id}`, {
      method: 'PATCH',
      body: {
        name: payload.name,
        industry: payload.industry,
        industryRefId: payload.industryRefId,
        ownerUserId: payload.ownerUserId,
        contactPerson: payload.contactPerson,
        email: payload.email,
        phone: payload.phone,
        billingAddress: payload.billingAddress ?? payload.address,
      },
    });
    const mapped = toCompany(updated.client);
    setCompanies((prev) => prev.map((c) => (c.id === mapped.id ? mapped : c)));
  };

  const deleteCompany = async (id: string): Promise<void> => {
    setCompanies((prev) => prev.filter((company) => company.id !== id));
  };

  return (
    <CompaniesContext.Provider value={{ companies, loading, getCompany, refreshCompanies, createCompany, updateCompany, deleteCompany }}>
      {children}
    </CompaniesContext.Provider>
  );
};

export const useCompanies = (): CompaniesContextType => {
  const context = useContext(CompaniesContext);
  if (!context) {
    throw new Error('useCompanies must be used within a CompaniesProvider');
  }
  return context;
};
