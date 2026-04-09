
export class StorageService<T> {
    private key: string;
    private version: number;

    constructor(key: string, version: number = 1) {
        this.key = key;
        this.version = version;
    }

    private getFullKey(): string {
        return `${this.key}_v${this.version}`;
    }

    getAll(): T[] {
        try {
            const data = localStorage.getItem(this.getFullKey());
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error(`Error reading from storage ${this.key}:`, error);
            return [];
        }
    }

    saveAll(items: T[]): void {
        try {
            localStorage.setItem(this.getFullKey(), JSON.stringify(items));
        } catch (error) {
            console.error(`Error writing to storage ${this.key}:`, error);
        }
    }

    getById(id: string): T | undefined {
        const items = this.getAll();
        return items.find((item: any) => item.id === id);
    }

    add(item: T): void {
        const items = this.getAll();
        items.push(item);
        this.saveAll(items);
    }

    update(id: string, updates: Partial<T>): T | null {
        const items = this.getAll();
        const index = items.findIndex((item: any) => item.id === id);

        if (index === -1) return null;

        items[index] = { ...items[index], ...updates };
        this.saveAll(items);
        return items[index];
    }

    delete(id: string): void {
        const items = this.getAll();
        const filtered = items.filter((item: any) => item.id === id);
        this.saveAll(filtered);
    }

    // Bulk override (for seeding)
    seed(items: T[]): void {
        if (this.getAll().length === 0) {
            this.saveAll(items);
        }
    }
}
