import { Deal } from '../types/deal';
import { Company } from '../types/company';
import { Person } from '../types/person';
import { Stage } from '../constants/crm';

export interface StageAggregate {
    stage: Stage;
    count: number;
    totalValue: number;
    formattedValue: string;
}

export interface CrmKpis {
    totalValue: number;
    formattedTotalValue: string;
    openDealsCount: number;
    avgDealSize: number;
    formattedAvgDealSize: string;
    avgDealAge: number; // in days
}

export interface EnrichedDeal extends Deal {
    companyName: string;
    primaryContactName?: string;
}

import { formatCurrency } from '../utils/formatters';

// ... (other imports remain)

/**
 * Stage aggregation (used by both Overview chart and Pipeline header)
 */
export function selectStageAggregates(deals: Deal[]): StageAggregate[] {
    if (!deals || !Array.isArray(deals)) return [];

    const stages: Stage[] = ['Discovery', 'Qualified', 'Proposal', 'Negotiation', 'Closing'];

    return stages.map(stage => {
        const stageDeals = deals.filter(d => d.stage === stage);
        const totalValue = stageDeals.reduce((sum, d) => sum + d.numericValue, 0);

        return {
            stage,
            count: stageDeals.length,
            totalValue,
            formattedValue: formatCurrency(totalValue)
        };
    });
}

/**
 * KPIs for Overview stat cards
 */
export function selectKpis(deals: Deal[]): CrmKpis {
    if (!deals || !Array.isArray(deals)) {
        return {
            totalValue: 0,
            formattedTotalValue: '$0',
            openDealsCount: 0,
            avgDealSize: 0,
            formattedAvgDealSize: '$0',
            avgDealAge: 0
        };
    }

    const totalValue = deals.reduce((sum, d) => sum + d.numericValue, 0);
    const openDealsCount = deals.length;
    const avgDealSize = openDealsCount > 0 ? totalValue / openDealsCount : 0;

    // Calculate average age
    const now = Date.now();
    const totalAge = deals.reduce((sum, d) => {
        const created = new Date(d.createdAt).getTime();
        return sum + (now - created);
    }, 0);
    const avgDealAge = openDealsCount > 0
        ? Math.floor(totalAge / openDealsCount / (1000 * 60 * 60 * 24))
        : 0;

    return {
        totalValue,
        formattedTotalValue: formatCurrency(totalValue),
        openDealsCount,
        avgDealSize,
        formattedAvgDealSize: formatCurrency(avgDealSize),
        avgDealAge
    };
}

/**
 * Top N deals (for Overview table)
 */
export function selectTopDeals(
    deals: Deal[],
    limit: number = 10,
    sortBy: 'value' | 'updated' = 'value'
): Deal[] {
    if (!deals || !Array.isArray(deals)) return [];

    const sorted = [...deals].sort((a, b) => {
        if (sortBy === 'value') {
            return b.numericValue - a.numericValue;
        } else {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
    });

    return sorted.slice(0, limit);
}

/**
 * Enrich deal with company/person names
 */
export function selectDealEnriched(
    deal: Deal,
    companies: Company[],
    people: Person[]
): EnrichedDeal {
    const company = companies.find(c => c.id === deal.companyId);
    const primaryContact = deal.primaryContactId
        ? people.find(p => p.id === deal.primaryContactId)
        : undefined;

    return {
        ...deal,
        companyName: company?.name || 'Unknown Company',
        primaryContactName: primaryContact?.name
    };
}
