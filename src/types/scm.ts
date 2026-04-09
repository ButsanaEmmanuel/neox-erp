export type SupplierStatus = "active" | "inactive" | "on-hold" | "archived";

export interface ScmSupplierContact {
    id: string;
    name: string;
    role: string;
    email: string;
    phone: string;
}

export interface ScmSupplier {
    id: string;
    name: string;
    status: SupplierStatus;
    rating?: number;        // 0..5
    leadTimeDays?: number;  // integer days
    paymentTerms?: string; // Added for compatibility
    contacts: ScmSupplierContact[]; // Changed: array of objects
    tags: string[];
    activePOs?: number;
    email?: string;
    phone?: string;
    address?: string;
    description?: string;
    lastActivityAt?: string; // Added for compatibility
    createdAt: string;
    updatedAt: string;
}

// Alias for backward compatibility
export type Supplier = ScmSupplier;

export interface CreateSupplierDTO {
    name: string;
    status: SupplierStatus;
    rating?: number;
    leadTimeDays?: number;
    tags: string[];
    email?: string;
    phone?: string;
    address?: string;
    description?: string;
    paymentTerms?: string;
    contacts?: ScmSupplierContact[];
}

export interface UpdateSupplierDTO extends Partial<CreateSupplierDTO> { }

// --- RESTORED TYPES (Inferred from SCMContext usage) ---

export type ProductStatus = 'active' | 'archived' | 'discontinued';

export interface Product {
    id: string;
    sku: string;
    name: string;
    category: string;
    unit: string;
    cost: number;
    price: number;
    reorderPoint: number;
    preferredSupplierId?: string;
    status: ProductStatus;
}

// --- NEW SCM PRODUCT TYPES (Strictly matching user request) ---
export interface ScmProduct {
    id: string;
    name: string;
    sku: string;
    category: string;
    costPerUnit: number;
    preferredSupplierId: string;
    status: 'active' | 'inactive';
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface ScmCategory {
    id: string;
    name: string;
    prefix: string; // 2-6 chars, unique
    nextSequence: number;
    status: 'active' | 'archived';
    updatedAt: string;
}

export interface CreateCategoryDTO {
    name: string;
    prefix: string;
    nextSequence?: number;
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {
    status?: 'active' | 'archived';
}

export interface CreateProductDTO {
    name: string;
    sku: string;
    category: string;
    costPerUnit: number;
    preferredSupplierId: string;
    status: 'active' | 'inactive';
    tags: string[];
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> { }

export type LocationType = 'warehouse' | 'site' | 'office' | 'yard' | 'other';

export interface Location {
    id: string;
    name: string;
    type: LocationType;
    facilityLabel?: string;
    address?: string;
    city?: string;
    country?: string;
    capacity?: number;
    capacityUnits?: string;
    status: 'active' | 'inactive' | 'full';
}

export interface InventoryRow {
    id: string; // Unique ID (often productId + locationId)
    productId: string;
    locationId: string;
    onHand: number;
    reserved: number;
    updatedAt: string;
}

// Derived status: CRITICAL, LOW, HEALTHY, OPTIMIZED
export type InventoryStatus = 'CRITICAL' | 'LOW' | 'HEALTHY' | 'OPTIMIZED' | 'NEUTRAL';

export interface StockThresholds {
    lowThreshold: number;
    criticalThreshold: number;
    enabled: boolean;
    low?: number;
    critical?: number;
}

export type AuditEventType = 'transfer' | 'reconcile' | 'adjust' | 'reserve' | 'receive';

export interface InventoryAuditEvent {
    id: string;
    type: AuditEventType;
    productId: string;
    locationId: string;
    timestamp: string;
    actor: string;
    meta: {
        qty?: number;
        fromLocationId?: string;
        toLocationId?: string;
        reason?: string;
        note?: string;
        previousQty?: number;
        newQty?: number;
        delta?: number;
    };
}



export type ShipmentStatus = 'planned' | 'scheduled' | 'in-transit' | 'delivered' | 'delayed' | 'cancelled' | 'exception';
export type ShipmentType = 'inbound' | 'outbound' | 'transfer';

export interface ShipmentItem {
    productId: string;
    qty: number;
}

export interface Shipment {
    id: string;
    reference: string;
    type: ShipmentType;
    status: ShipmentStatus;
    carrier: string;
    tracking: string;
    supplierId?: string;
    originLocationId?: string;
    destinationLocationId: string;
    eta: string;
    items: ShipmentItem[];

}

export interface Requisition {
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
    requestedBy: string;
    items: { productId: string; qty: number }[];
    createdAt: string;
}

export interface SCMActivity {
    id: string;
    type: string;
    message: string;
    timestamp: string;
}

export interface StockAlertSettings {
    enabled: boolean;
    defaultThresholds: StockThresholds;
    categoryOverrides: Record<string, StockThresholds>; // categoryId -> thresholds
    updatedAt: string;
}

export type StockStatus = 'normal' | 'low' | 'critical';

export interface StockItem {
    id: string;
    productId: string;
    locationId: string;
    onHand: number;
    reserved: number;
    available: number;
    min: number;
    max: number;
    updatedAt: string;
}

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    supplierId: string;
    status: string;
    issueDate: string;
    expectedDate: string;
    currency: string;
    items: Array<{ productId: string; qty: number; unitCost: number; receivedQty: number }>;
    subtotal: number;
    tax: number;
    total: number;
    createdAt: string;
    updatedAt: string;
}

export interface SCMSummary {
    totalOnHandValue: number;
    lowStockSkuCount: number;
    openPOCount: number;
    inboundShipmentCount: number;
    avgLeadTime: number;
}


