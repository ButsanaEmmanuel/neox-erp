import { ScmSupplier, CreateSupplierDTO, UpdateSupplierDTO } from '../../types/scm';
import {
  createSupplierApi,
  deleteSupplierApi,
  fetchSupplierApi,
  fetchSuppliersApi,
  updateSupplierApi,
} from '../../services/scmApi';

export interface ScmRepository {
  getSuppliers(): Promise<ScmSupplier[]>;
  getSupplier(id: string): Promise<ScmSupplier | null>;
  createSupplier(data: CreateSupplierDTO): Promise<ScmSupplier>;
  updateSupplier(id: string, data: UpdateSupplierDTO): Promise<ScmSupplier>;
  deleteSupplier(id: string): Promise<void>;
}

class ApiScmRepository implements ScmRepository {
  async getSuppliers(): Promise<ScmSupplier[]> {
    return fetchSuppliersApi();
  }

  async getSupplier(id: string): Promise<ScmSupplier | null> {
    try {
      return await fetchSupplierApi(id);
    } catch {
      return null;
    }
  }

  async createSupplier(data: CreateSupplierDTO): Promise<ScmSupplier> {
    return createSupplierApi(data);
  }

  async updateSupplier(id: string, data: UpdateSupplierDTO): Promise<ScmSupplier> {
    return updateSupplierApi(id, data);
  }

  async deleteSupplier(id: string): Promise<void> {
    await deleteSupplierApi(id);
  }
}

export const scmRepository = new ApiScmRepository();
