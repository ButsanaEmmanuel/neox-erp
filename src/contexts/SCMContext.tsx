import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
import {
    Supplier,
    Product,
    Location,
    StockItem,
    PurchaseOrder,
    Shipment,
    Requisition,
    SCMActivity,
    SCMSummary,
} from '../types/scm';
import { apiRequest } from '../lib/apiClient';
import { createSupplierApi, fetchScmBootstrapApi, fetchSuppliersApi } from '../services/scmApi';

interface SCMContextType {
    suppliers: Supplier[];
    products: Product[];
    locations: Location[];
    inventory: StockItem[];
    purchaseOrders: PurchaseOrder[];
    shipments: Shipment[];
    requisitions: Requisition[];
    activities: SCMActivity[];
    summary: SCMSummary;
    loading: boolean;

    // Actions
    createPO: (data: Partial<PurchaseOrder>) => Promise<void>;
    receivePO: (poId: string, locationId: string) => Promise<void>;
    adjustStock: (stockId: string, adjustment: number) => Promise<void>;
    createSupplier: (data: Partial<Supplier>) => Promise<void>;
    linkContactToSupplier: (supplierId: string, personId: string) => Promise<void>;
}

const SCMContext = createContext<SCMContextType | undefined>(undefined);

export const SCMProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [inventory, setInventory] = useState<StockItem[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [activities, setActivities] = useState<SCMActivity[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const hydrate = async () => {
            setLoading(true);
            try {
                const [supplierRows, bootstrap, poRows, shipmentRows, requisitionRows, activityRows, productRows] = await Promise.all([
                    fetchSuppliersApi(),
                    fetchScmBootstrapApi(),
                    apiRequest<PurchaseOrder[]>('/api/v1/scm/purchase-orders'),
                    apiRequest<Shipment[]>('/api/v1/scm/shipments'),
                    apiRequest<Requisition[]>('/api/v1/scm/requisitions'),
                    apiRequest<SCMActivity[]>('/api/v1/scm/activities'),
                    apiRequest<Product[]>('/api/v1/scm/products/legacy').catch(() => [])
                ]);

                setSuppliers(supplierRows);
                setLocations(bootstrap.locations as unknown as Location[]);
                setInventory(bootstrap.inventory as unknown as StockItem[]);
                setPurchaseOrders(poRows);
                setShipments(shipmentRows);
                setRequisitions(requisitionRows);
                setActivities(activityRows);
                setProducts(productRows);
            } catch {
                setSuppliers([]);
                setProducts([]);
                setLocations([]);
                setInventory([]);
                setPurchaseOrders([]);
                setShipments([]);
                setRequisitions([]);
                setActivities([]);
            } finally {
                setLoading(false);
            }
        };

        hydrate();
    }, []);

    const summary = useMemo((): SCMSummary => {
        const totalOnHandValue = inventory.reduce((sum, item) => {
            const prod = products.find((p) => p.id === item.productId);
            return sum + (item.onHand * (prod?.cost || 0));
        }, 0);

        const lowStockSkuCount = inventory.filter((item) => item.onHand <= item.min).length;
        const openPOCount = purchaseOrders.filter((po) => ['sent', 'partial'].includes(po.status)).length;
        const inboundShipmentCount = shipments.filter((s) => s.type === 'inbound' && s.status !== 'delivered').length;

        return {
            totalOnHandValue,
            lowStockSkuCount,
            openPOCount,
            inboundShipmentCount,
            avgLeadTime: 0
        };
    }, [inventory, products, purchaseOrders, shipments]);

    const createPO = async (data: Partial<PurchaseOrder>) => {
        setLoading(true);
        try {
            await apiRequest<PurchaseOrder>('/api/v1/scm/purchase-orders', { method: 'POST', body: data });
            const rows = await apiRequest<PurchaseOrder[]>('/api/v1/scm/purchase-orders');
            setPurchaseOrders(rows);
        } finally {
            setLoading(false);
        }
    };

    const receivePO = async (poId: string, locationId: string) => {
        setLoading(true);
        try {
            await apiRequest<void>(`/api/v1/scm/purchase-orders/${poId}/receive`, {
                method: 'POST',
                body: { locationId }
            });
            const [updatedPOs, bootstrap] = await Promise.all([
                apiRequest<PurchaseOrder[]>('/api/v1/scm/purchase-orders'),
                fetchScmBootstrapApi()
            ]);
            setPurchaseOrders(updatedPOs);
            setInventory(bootstrap.inventory as unknown as StockItem[]);
        } finally {
            setLoading(false);
        }
    };

    const adjustStock = async (stockId: string, adjustment: number) => {
        setLoading(true);
        try {
            await apiRequest<void>(`/api/v1/scm/inventory/${stockId}/adjust`, {
                method: 'POST',
                body: { adjustment }
            });
            const bootstrap = await fetchScmBootstrapApi();
            setInventory(bootstrap.inventory as unknown as StockItem[]);
        } finally {
            setLoading(false);
        }
    };

    const createSupplier = async (data: Partial<Supplier>) => {
        setLoading(true);
        try {
            await createSupplierApi({
                name: data.name || '',
                status: (data.status as Supplier['status']) || 'active',
                tags: data.tags || [],
                rating: data.rating,
                leadTimeDays: data.leadTimeDays,
                paymentTerms: data.paymentTerms,
                email: data.email,
                phone: data.phone,
                address: data.address,
                description: data.description,
                contacts: []
            });
            const rows = await fetchSuppliersApi();
            setSuppliers(rows);
        } finally {
            setLoading(false);
        }
    };

    const linkContactToSupplier = async (supplierId: string, personId: string) => {
        setLoading(true);
        try {
            await apiRequest<void>(`/api/v1/scm/suppliers/${supplierId}/contacts`, {
                method: 'POST',
                body: { personId }
            });
            const rows = await fetchSuppliersApi();
            setSuppliers(rows);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SCMContext.Provider value={{
            suppliers,
            products,
            locations,
            inventory,
            purchaseOrders,
            shipments,
            requisitions,
            activities,
            summary,
            loading,
            createPO,
            receivePO,
            adjustStock,
            createSupplier,
            linkContactToSupplier
        }}>
            {children}
        </SCMContext.Provider>
    );
};

export const useSCM = () => {
    const context = useContext(SCMContext);
    if (!context) throw new Error('useSCM must be used within a SCMProvider');
    return context;
};
