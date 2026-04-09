import { StorageService } from '../storage/storage';
import { PurchaseOrder, GRN, InventoryTransaction } from '../../types/po';
import { v4 as uuidv4 } from 'uuid';

// --- PO Repository ---
export class PORepository {
    private storage: StorageService<PurchaseOrder>;

    constructor() {
        this.storage = new StorageService<PurchaseOrder>('erp.purchaseOrders', 2);
    }

    getAll(): PurchaseOrder[] {
        return this.storage.getAll();
    }

    getById(id: string): PurchaseOrder | undefined {
        return this.storage.getById(id);
    }

    create(po: PurchaseOrder): void {
        this.storage.add(po);
    }

    update(id: string, updates: Partial<PurchaseOrder>): PurchaseOrder | null {
        return this.storage.update(id, updates);
    }

    seed(pos: PurchaseOrder[]) {
        this.storage.seed(pos);
    }
}

// --- GRN Repository ---
export class GRNRepository {
    private storage: StorageService<GRN>;

    constructor() {
        this.storage = new StorageService<GRN>('erp.grns', 2);
    }

    getAll(): GRN[] {
        return this.storage.getAll();
    }

    create(grn: GRN): void {
        this.storage.add(grn);
    }

    getByPoId(poId: string): GRN[] {
        return this.storage.getAll().filter(g => g.poId === poId);
    }
}

// --- Inventory Ledger Repository ---
export class InventoryLedgerRepository {
    private storage: StorageService<InventoryTransaction>;

    constructor() {
        this.storage = new StorageService<InventoryTransaction>('erp.inventoryLedger', 2);
    }

    addTransaction(txn: InventoryTransaction): void {
        this.storage.add(txn);
    }

    getTransactionsByProduct(productId: string): InventoryTransaction[] {
        return this.storage.getAll().filter(t => t.productId === productId);
    }

    getAll(): InventoryTransaction[] {
        return this.storage.getAll();
    }
}

export const poRepo = new PORepository();
export const grnRepo = new GRNRepository();
export const inventoryRepo = new InventoryLedgerRepository();
