import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    ScmSupplier, CreateSupplierDTO, UpdateSupplierDTO, ScmSupplierContact,
    ScmProduct, CreateProductDTO, UpdateProductDTO,
    ScmCategory, CreateCategoryDTO, UpdateCategoryDTO,
    StockAlertSettings, InventoryRow, Location, InventoryAuditEvent, StockThresholds, InventoryStatus
} from '../../types/scm';
import { scmRepository } from '../../lib/scm/scm-repository';
import {
    createCategoryApi,
    createProductApi,
    fetchCategoriesApi,
    fetchProductsApi,
    fetchScmBootstrapApi,
    updateCategoryApi,
    updateProductApi,
    deleteProductApi
} from '../../services/scmApi';

interface ScmState {
    suppliers: ScmSupplier[];
    loading: boolean;
    error: string | null;
    initialized: boolean;

    // UI State
    selectedSupplierId: string | null;
    isCreateModalOpen: boolean;
    isAddContactModalOpen: boolean;

    // Actions
    hydrateFromDatabase: () => Promise<void>;
    fetchSuppliers: () => Promise<void>;
    createSupplier: (data: CreateSupplierDTO) => Promise<void>;
    updateSupplier: (id: string, data: UpdateSupplierDTO) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;
    addSupplierContact: (supplierId: string, contact: ScmSupplierContact) => Promise<void>;

    // UI Actions
    setSelectedSupplierId: (id: string | null) => void;
    setCreateModalOpen: (open: boolean) => void;
    setAddContactModalOpen: (open: boolean) => void;

    // --- Product State & Actions ---
    products: ScmProduct[];
    selectedProductId: string | null;
    isCreateProductModalOpen: boolean;

    // --- Category State & Actions ---
    categories: ScmCategory[];
    fetchCategories: () => Promise<void>;
    createCategory: (data: CreateCategoryDTO) => Promise<void>;
    updateCategory: (id: string, data: UpdateCategoryDTO) => Promise<void>;
    archiveCategory: (id: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;

    fetchProducts: () => Promise<void>;
    createProduct: (data: CreateProductDTO) => Promise<void>;
    updateProduct: (id: string, data: UpdateProductDTO) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    setSelectedProductId: (id: string | null) => void;
    setCreateProductModalOpen: (open: boolean) => void;

    // --- Inventory State & Actions ---
    inventory: InventoryRow[];
    locations: Location[];
    auditLog: InventoryAuditEvent[];
    stockThresholds: StockThresholds;

    transferStock: (payload: {
        productId: string;
        fromLocationId: string;
        toLocationId: string;
        qty: number;
        note?: string;
        actor: string;
    }) => Promise<void>;

    reconcileStock: (payload: {
        productId: string;
        locationId: string;
        countedQty: number;
        reason: string;
        note?: string;
        actor: string;
    }) => Promise<void>;

    reserveStock: (payload: {
        productId: string;
        locationId: string;
        qty: number;
        note?: string;
        actor: string;
    }) => Promise<void>;

    receiveStock: (payload: {
        productId: string;
        locationId: string;
        qty: number;
        note?: string;
        actor: string;
    }) => Promise<void>;

    // --- Selectors (Getters) ---
    getProductStockTotals: (productId: string) => { onHand: number; reserved: number; available: number };
    getProductsWithComputedStock: () => (ScmProduct & { stockLevel: number; status_summary: InventoryStatus })[];
    getInventoryGroupedByProduct: () => { product: ScmProduct; rows: InventoryRow[]; totalOnHand: number }[];
    getInventoryForLocation: (locationId: string) => (InventoryRow & { productName: string; sku: string })[];

    // --- Purchase Order State & Actions ---


    // --- Location Actions ---
    createLocation: (location: Location) => Promise<void>;
    updateLocation: (id: string, updates: Partial<Location>) => Promise<void>;
    deleteLocation: (id: string) => Promise<void>;

    // --- Stock Alerts ---
    stockAlertSettings: StockAlertSettings;
    updateStockAlertSettings: (settings: Partial<StockAlertSettings>) => void;
}

export const useScmStore = create<ScmState>()(
    persist(
        (set, get) => ({
            suppliers: [],
            loading: false,
            error: null,
            initialized: false,
            selectedSupplierId: null,
            isCreateModalOpen: false,
            isAddContactModalOpen: false,

            // Product Initial State
            products: [],
            selectedProductId: null,
            isCreateProductModalOpen: false,

            // Category Initial State
            categories: [],

            // Inventory Initial State
            inventory: [],
            locations: [],
            auditLog: [],
            stockThresholds: {
                enabled: true,
                lowThreshold: 10,
                criticalThreshold: 3,
                low: 10,
                critical: 3
            },

            // Stock Alerts Initial State
            stockAlertSettings: {
                enabled: true,
                defaultThresholds: { lowThreshold: 10, criticalThreshold: 3, enabled: true },
                categoryOverrides: {},
                updatedAt: new Date().toISOString()
            },

            hydrateFromDatabase: async () => {
                set({ loading: true, error: null });
                try {
                    const [suppliers, products, categories, bootstrap] = await Promise.all([
                        scmRepository.getSuppliers(),
                        fetchProductsApi(),
                        fetchCategoriesApi(),
                        fetchScmBootstrapApi()
                    ]);

                    set({
                        suppliers,
                        products,
                        categories,
                        inventory: bootstrap.inventory ?? [],
                        locations: bootstrap.locations ?? [],
                        auditLog: bootstrap.auditLog ?? [],
                        stockThresholds: bootstrap.stockThresholds
                            ? {
                                ...bootstrap.stockThresholds,
                                low: bootstrap.stockThresholds.low ?? bootstrap.stockThresholds.lowThreshold,
                                critical: bootstrap.stockThresholds.critical ?? bootstrap.stockThresholds.criticalThreshold
                            }
                            : get().stockThresholds,
                        loading: false,
                        initialized: true
                    });
                } catch (err) {
                    set({
                        suppliers: [],
                        products: [],
                        categories: [],
                        inventory: [],
                        locations: [],
                        auditLog: [],
                        error: (err as Error).message,
                        loading: false
                    });
                }
            },

            // --- Selectors ---
            getProductStockTotals: (productId: string) => {
                const rows = get().inventory.filter(r => r.productId === productId);
                const onHand = rows.reduce((sum, r) => sum + r.onHand, 0);
                const reserved = rows.reduce((sum, r) => sum + r.reserved, 0);
                return { onHand, reserved, available: onHand - reserved };
            },

            getProductsWithComputedStock: () => {
                const { products, stockThresholds } = get();
                return products.map(p => {
                    const totals = get().getProductStockTotals(p.id);
                    return {
                        ...p,
                        stockLevel: totals.onHand,
                        status_summary: computeStatus(totals.onHand, stockThresholds)
                    };
                });
            },

            getInventoryGroupedByProduct: () => {
                const { products, inventory } = get();
                return products.map(product => {
                    const rows = inventory.filter(r => r.productId === product.id);
                    const totalOnHand = rows.reduce((sum, r) => sum + r.onHand, 0);
                    return { product, rows, totalOnHand };
                });
            },

            getInventoryForLocation: (locationId: string) => {
                const { inventory, products } = get();
                return inventory
                    .filter(r => r.locationId === locationId)
                    .map(r => {
                        const product = products.find(p => p.id === r.productId);
                        return {
                            ...r,
                            productName: product?.name || 'Unknown Product',
                            sku: product?.sku || 'N/A'
                        };
                    });
            },

            // --- Mutations ---
            transferStock: async ({ productId, fromLocationId, toLocationId, qty, note, actor }) => {
                const { inventory } = get();
                const fromRow = inventory.find(r => r.productId === productId && r.locationId === fromLocationId);

                if (!fromRow || (fromRow.onHand - fromRow.reserved) < qty) {
                    throw new Error('Insufficient available stock at source');
                }

                let newInventory = inventory.map(r => {
                    if (r.productId === productId && r.locationId === fromLocationId) {
                        return { ...r, onHand: r.onHand - qty, updatedAt: new Date().toISOString() };
                    }
                    if (r.productId === productId && r.locationId === toLocationId) {
                        return { ...r, onHand: r.onHand + qty, updatedAt: new Date().toISOString() };
                    }
                    return r;
                });

                // Ensure target row exists
                const toRowExists = inventory.some(r => r.productId === productId && r.locationId === toLocationId);
                if (!toRowExists) {
                    const newRow: InventoryRow = {
                        id: `${productId}-${toLocationId}`,
                        productId,
                        locationId: toLocationId,
                        onHand: qty,
                        reserved: 0,
                        updatedAt: new Date().toISOString()
                    };
                    newInventory.push(newRow);
                }

                set({ inventory: newInventory });

                // Audit
                const auditEvent: InventoryAuditEvent = {
                    id: `audit-${Date.now()}`,
                    type: 'transfer',
                    productId,
                    locationId: fromLocationId,
                    timestamp: new Date().toISOString(),
                    actor,
                    meta: { qty, fromLocationId, toLocationId, note }
                };
                set(state => ({ auditLog: [auditEvent, ...state.auditLog] }));
            },

            reconcileStock: async ({ productId, locationId, countedQty, reason, note, actor }) => {
                const { inventory } = get();
                const row = inventory.find(r => r.productId === productId && r.locationId === locationId);

                const previousQty = row?.onHand || 0;
                const delta = countedQty - previousQty;

                let newInventory;
                if (!row) {
                    const newRow: InventoryRow = {
                        id: `${productId}-${locationId}`,
                        productId,
                        locationId,
                        onHand: countedQty,
                        reserved: 0,
                        updatedAt: new Date().toISOString()
                    };
                    newInventory = [...inventory, newRow];
                } else {
                    newInventory = inventory.map(r =>
                        (r.productId === productId && r.locationId === locationId)
                            ? { ...r, onHand: countedQty, updatedAt: new Date().toISOString() }
                            : r
                    );
                }

                set({ inventory: newInventory });

                // Audit
                const auditEvent: InventoryAuditEvent = {
                    id: `audit-${Date.now()}`,
                    type: 'reconcile',
                    productId,
                    locationId,
                    timestamp: new Date().toISOString(),
                    actor,
                    meta: { previousQty, newQty: countedQty, delta, reason, note }
                };
                set(state => ({ auditLog: [auditEvent, ...state.auditLog] }));
            },

            reserveStock: async ({ productId, locationId, qty, note, actor }) => {
                const { inventory } = get();
                const row = inventory.find(r => r.productId === productId && r.locationId === locationId);

                if (!row || (row.onHand - row.reserved) < qty) {
                    throw new Error('Insufficient available stock to reserve');
                }

                const newInventory = inventory.map(r =>
                    (r.productId === productId && r.locationId === locationId)
                        ? { ...r, reserved: r.reserved + qty, updatedAt: new Date().toISOString() }
                        : r
                );

                set({ inventory: newInventory });

                // Audit
                const auditEvent: InventoryAuditEvent = {
                    id: `audit-${Date.now()}`,
                    type: 'reserve',
                    productId,
                    locationId,
                    timestamp: new Date().toISOString(),
                    actor,
                    meta: { qty, note }
                };
                set(state => ({ auditLog: [auditEvent, ...state.auditLog] }));
            },

            receiveStock: async ({ productId, locationId, qty, note, actor }) => {
                const { inventory } = get();
                const row = inventory.find(r => r.productId === productId && r.locationId === locationId);

                let newInventory;
                if (!row) {
                    const newRow: InventoryRow = {
                        id: `${productId}-${locationId}`,
                        productId,
                        locationId,
                        onHand: qty,
                        reserved: 0,
                        updatedAt: new Date().toISOString()
                    };
                    newInventory = [...inventory, newRow];
                } else {
                    newInventory = inventory.map(r =>
                        (r.productId === productId && r.locationId === locationId)
                            ? { ...r, onHand: r.onHand + qty, updatedAt: new Date().toISOString() }
                            : r
                    );
                }

                set({ inventory: newInventory });

                // Audit
                const auditEvent: InventoryAuditEvent = {
                    id: `audit-${Date.now()}`,
                    type: 'receive',
                    productId,
                    locationId,
                    timestamp: new Date().toISOString(),
                    actor,
                    meta: { qty, note }
                };
                set(state => ({ auditLog: [auditEvent, ...state.auditLog] }));
            },

            // --- Supplier Actions (existing) ---
            fetchSuppliers: async () => {
                set({ loading: true, error: null });
                try {
                    const data = await scmRepository.getSuppliers();
                    set({ suppliers: data, loading: false, initialized: true });
                } catch (err) {
                    set({ suppliers: [], error: (err as Error).message, loading: false });
                }
            },

            createSupplier: async (data: CreateSupplierDTO) => {
                set({ loading: true, error: null });
                try {
                    const newSupplier = await scmRepository.createSupplier(data);
                    const suppliers = await scmRepository.getSuppliers();
                    set({
                        suppliers,
                        loading: false,
                        selectedSupplierId: newSupplier.id,
                        isCreateModalOpen: false
                    });
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            updateSupplier: async (id: string, data: UpdateSupplierDTO) => {
                set({ loading: true, error: null });
                try {
                    await scmRepository.updateSupplier(id, data);
                    const suppliers = await scmRepository.getSuppliers();
                    set({ suppliers, loading: false });
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            deleteSupplier: async (id: string) => {
                set({ loading: true, error: null });
                try {
                    await scmRepository.deleteSupplier(id);
                    const suppliers = await scmRepository.getSuppliers();
                    set(state => ({
                        suppliers,
                        loading: false,
                        selectedSupplierId: state.selectedSupplierId === id ? null : state.selectedSupplierId
                    }));
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            addSupplierContact: async (supplierId: string, contact: ScmSupplierContact) => {
                set({ loading: true, error: null });
                try {
                    const state = get();
                    const supplier = state.suppliers.find(s => s.id === supplierId);
                    if (!supplier) throw new Error("Supplier not found");
                    const updatedContacts = [...(supplier.contacts || []), contact];
                    await state.updateSupplier(supplierId, { contacts: updatedContacts });
                    set({ isAddContactModalOpen: false, loading: false });
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            setSelectedSupplierId: (id) => set({ selectedSupplierId: id }),
            setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
            setAddContactModalOpen: (open) => set({ isAddContactModalOpen: open }),

            // --- Category Actions (existing) ---
            fetchCategories: async () => {
                set({ loading: true, error: null });
                try {
                    const categories = await fetchCategoriesApi();
                    set({ categories, loading: false });
                } catch (err) {
                    set({ categories: [], error: (err as Error).message, loading: false });
                }
            },

            createCategory: async (data: CreateCategoryDTO) => {
                set({ loading: true, error: null });
                try {
                    await createCategoryApi(data);
                    const categories = await fetchCategoriesApi();
                    set({ categories, loading: false });
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            updateCategory: async (id: string, data: UpdateCategoryDTO) => {
                set({ loading: true, error: null });
                try {
                    await updateCategoryApi(id, data);
                    const categories = await fetchCategoriesApi();
                    set({ categories, loading: false });
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            archiveCategory: async (id: string) => {
                await get().updateCategory(id, { status: 'archived' });
            },

            deleteCategory: async (id: string) => {
                await get().updateCategory(id, { status: 'archived' });
            },

            // --- Product Actions (existing) ---
            fetchProducts: async () => {
                set({ loading: true, error: null });
                try {
                    const products = await fetchProductsApi();
                    set({ products, loading: false });
                } catch (err) {
                    set({ products: [], error: (err as Error).message, loading: false });
                }
            },

            createProduct: async (data: CreateProductDTO) => {
                set({ loading: true, error: null });
                try {
                    const newProduct = await createProductApi(data);
                    const products = await fetchProductsApi();
                    set({
                        products,
                        isCreateProductModalOpen: false,
                        selectedProductId: newProduct.id,
                        loading: false
                    });
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            updateProduct: async (id: string, data: UpdateProductDTO) => {
                set({ loading: true, error: null });
                try {
                    await updateProductApi(id, data);
                    const products = await fetchProductsApi();
                    set({ products, loading: false });
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            deleteProduct: async (id: string) => {
                set({ loading: true, error: null });
                try {
                    await deleteProductApi(id);
                    const products = await fetchProductsApi();
                    set(state => ({
                        products,
                        selectedProductId: state.selectedProductId === id ? null : state.selectedProductId,
                        loading: false
                    }));
                } catch (err) {
                    set({ error: (err as Error).message, loading: false });
                }
            },

            setSelectedProductId: (id) => set({ selectedProductId: id }),

            // --- Location Actions ---
            createLocation: async (location) => {
                set(state => ({
                    locations: [...state.locations, { ...location, id: location.id || `loc-${Date.now()}` }]
                }));
            },

            updateLocation: async (id, updates) => {
                set(state => ({
                    locations: state.locations.map(l => l.id === id ? { ...l, ...updates } : l)
                }));
            },

            deleteLocation: async (id) => {
                set(state => ({
                    locations: state.locations.filter(l => l.id !== id)
                }));
            },
            setCreateProductModalOpen: (open) => set({ isCreateProductModalOpen: open }),



            // --- Stock Alert Actions ---
            updateStockAlertSettings: (settings) => {
                set(state => ({
                    stockAlertSettings: {
                        ...state.stockAlertSettings,
                        ...settings,
                        updatedAt: new Date().toISOString()
                    }
                }));
            }
        }),
        {
            name: 'scm-storage-v2',
            partialize: (state) => ({
                suppliers: state.suppliers,
                products: state.products,
                categories: state.categories,
                stockAlertSettings: state.stockAlertSettings,
                inventory: state.inventory,
                locations: state.locations,
                auditLog: state.auditLog,

            }),
        }
    )
);

// Helper for computing inventory status based on thresholds
export const computeStatus = (qty: number, thresholds: StockThresholds): InventoryStatus => {
    if (!thresholds.enabled) return 'NEUTRAL';
    if (qty <= thresholds.criticalThreshold) return 'CRITICAL';
    if (qty <= thresholds.lowThreshold) return 'LOW';
    return 'HEALTHY';
};
