import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Deal, CreateDealPayload, UpdateDealPayload } from '../types/deal';
import { formatCurrency } from '../utils/formatters';
import { apiRequest } from '../lib/apiClient';

interface DealsContextType {
  deals: Deal[];
  createDeal: (payload: CreateDealPayload, companies?: any[], people?: any[]) => Promise<Deal>;
  updateDeal: (payload: UpdateDealPayload) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  getDeals: () => Deal[];
  getDealsByStage: (stage: string) => Deal[];
  markDealWon: (id: string, options?: { wonAmount?: number; dueDate?: string; issueDate?: string }) => Promise<void>;
}

interface CrmDealDto {
  id: string;
  name: string;
  clientAccountId: string;
  stage: string;
  status: string;
  valueAmount: number;
  currencyCode: string;
  ownerName?: string | null;
  ownerUserId?: string | null;
  stageRefId?: string | null;
  closeDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  clientAccount?: {
    id: string;
    name: string;
  };
  ownerUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  stageRef?: {
    id: string;
    label: string;
    value: string;
  } | null;
}

const DealsContext = createContext<DealsContextType | undefined>(undefined);

const getOwnerInitials = (owner: string): string => {
  const names = owner.trim().split(/\s+/).filter(Boolean);
  if (names.length === 0) return 'NA';
  return names.map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const getStageProbability = (stage: string): number => {
  const stageProbs: Record<string, number> = {
    Discovery: 20,
    Qualified: 45,
    Proposal: 65,
    Negotiation: 80,
    Closing: 92,
    Won: 100,
  };
  return stageProbs[stage] || 50;
};

function mapDeal(dto: CrmDealDto): Deal {
  const ownerName = dto.ownerUser?.name || dto.ownerName || dto.ownerUser?.email || 'N/A';
  const effectiveStage = dto.stageRef?.label || dto.stage || 'Discovery';
  const probabilityValue = dto.status === 'won' ? 100 : getStageProbability(effectiveStage);
  return {
    id: dto.id,
    name: dto.name,
    companyId: dto.clientAccountId,
    company: {
      id: dto.clientAccountId,
      name: dto.clientAccount?.name || 'Unknown Client',
      initials: (dto.clientAccount?.name || 'NA').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    },
    primaryContactId: undefined,
    primaryContact: undefined,
    stakeholders: [],
    initials: (dto.clientAccount?.name || 'NA').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    stage: dto.status === 'won' ? 'Closing' as any : (effectiveStage as any),
    value: formatCurrency(Number(dto.valueAmount || 0), dto.currencyCode || 'USD'),
    numericValue: Number(dto.valueAmount || 0),
    currency: dto.currencyCode || 'USD',
    owner: getOwnerInitials(ownerName),
    probability: `${probabilityValue}%`,
    probabilityValue,
    lastActivity: new Date(dto.updatedAt).toLocaleDateString('fr-FR'),
    closeDate: dto.closeDate || undefined,
    notes: dto.notes || undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const DealsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deals, setDeals] = useState<Deal[]>([]);

  const refresh = async () => {
    try {
      const data = await apiRequest<{ deals: CrmDealDto[] }>('/api/v1/crm/deals?take=300');
      setDeals((data.deals || []).map(mapDeal));
    } catch {
      setDeals([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createDeal = async (payload: CreateDealPayload): Promise<Deal> => {
    const created = await apiRequest<{ deal: CrmDealDto }>('/api/v1/crm/deals', {
      method: 'POST',
      body: {
        name: payload.name,
        clientAccountId: payload.companyId,
        stage: payload.stage,
        stageRefId: payload.stageRefId || null,
        status: 'open',
        valueAmount: payload.value,
        currencyCode: payload.currency || 'USD',
        ownerName: payload.owner || null,
        ownerUserId: payload.ownerUserId || null,
        closeDate: payload.closeDate || null,
        notes: payload.notes || null,
      },
    });

    const mapped = mapDeal(created.deal);
    setDeals((prev) => [mapped, ...prev.filter((d) => d.id !== mapped.id)]);
    return mapped;
  };

  const updateDeal = async (payload: UpdateDealPayload): Promise<void> => {
    await apiRequest<{ deal: CrmDealDto }>(`/api/v1/crm/deals/${payload.id}`, {
      method: 'PATCH',
      body: {
        name: payload.name,
        stage: payload.stage,
        stageRefId: payload.stageRefId,
        valueAmount: payload.value,
        currencyCode: payload.currency,
        ownerName: payload.owner,
        ownerUserId: payload.ownerUserId,
        closeDate: payload.closeDate,
        notes: payload.notes,
      },
    });
    await refresh();
  };

  const deleteDeal = async (id: string): Promise<void> => {
    setDeals((prev) => prev.filter((deal) => deal.id !== id));
  };

  const markDealWon = async (id: string, options?: { wonAmount?: number; dueDate?: string; issueDate?: string }): Promise<void> => {
    await apiRequest(`/api/v1/crm/deals/${id}/won`, {
      method: 'POST',
      body: {
        wonAmount: options?.wonAmount,
        dueDate: options?.dueDate,
        issueDate: options?.issueDate,
      },
    });
    await refresh();
  };

  const getDeals = (): Deal[] => deals;
  const getDealsByStage = (stage: string): Deal[] => deals.filter((deal) => deal.stage === stage);

  return (
    <DealsContext.Provider value={{ deals, createDeal, updateDeal, deleteDeal, getDeals, getDealsByStage, markDealWon }}>
      {children}
    </DealsContext.Provider>
  );
};

export const useDeals = (): DealsContextType => {
  const context = useContext(DealsContext);
  if (!context) {
    throw new Error('useDeals must be used within a DealsProvider');
  }
  return context;
};
