import { apiRequest } from '../lib/apiClient';
import {
  CreateCategoryDTO,
  CreateProductDTO,
  CreateSupplierDTO,
  Location,
  ScmCategory,
  ScmProduct,
  ScmSupplier,
  StockThresholds,
  UpdateCategoryDTO,
  UpdateProductDTO,
  UpdateSupplierDTO,
  InventoryRow,
  InventoryAuditEvent,
} from '../types/scm';

export async function fetchSuppliersApi(): Promise<ScmSupplier[]> {
  return apiRequest<ScmSupplier[]>('/api/v1/scm/suppliers');
}

export async function fetchSupplierApi(id: string): Promise<ScmSupplier> {
  return apiRequest<ScmSupplier>(`/api/v1/scm/suppliers/${id}`);
}

export async function createSupplierApi(payload: CreateSupplierDTO): Promise<ScmSupplier> {
  return apiRequest<ScmSupplier>('/api/v1/scm/suppliers', {
    method: 'POST',
    body: payload,
  });
}

export async function updateSupplierApi(id: string, payload: UpdateSupplierDTO): Promise<ScmSupplier> {
  return apiRequest<ScmSupplier>(`/api/v1/scm/suppliers/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteSupplierApi(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/scm/suppliers/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchProductsApi(): Promise<ScmProduct[]> {
  return apiRequest<ScmProduct[]>('/api/v1/scm/products');
}

export async function createProductApi(payload: CreateProductDTO): Promise<ScmProduct> {
  return apiRequest<ScmProduct>('/api/v1/scm/products', {
    method: 'POST',
    body: payload,
  });
}

export async function updateProductApi(id: string, payload: UpdateProductDTO): Promise<ScmProduct> {
  return apiRequest<ScmProduct>(`/api/v1/scm/products/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteProductApi(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/scm/products/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchCategoriesApi(): Promise<ScmCategory[]> {
  return apiRequest<ScmCategory[]>('/api/v1/scm/categories');
}

export async function createCategoryApi(payload: CreateCategoryDTO): Promise<ScmCategory> {
  return apiRequest<ScmCategory>('/api/v1/scm/categories', {
    method: 'POST',
    body: payload,
  });
}

export async function updateCategoryApi(id: string, payload: UpdateCategoryDTO): Promise<ScmCategory> {
  return apiRequest<ScmCategory>(`/api/v1/scm/categories/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export interface ScmBootstrapResponse {
  inventory: InventoryRow[];
  locations: Location[];
  auditLog: InventoryAuditEvent[];
  stockThresholds?: StockThresholds;
}

export async function fetchScmBootstrapApi(): Promise<ScmBootstrapResponse> {
  return apiRequest<ScmBootstrapResponse>('/api/v1/scm/bootstrap');
}
