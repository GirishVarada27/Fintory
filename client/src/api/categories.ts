import { api, type ItemResponse } from "./client";
import type { CreateCategoryInput, UpdateCategoryInput } from "../../../shared/schemas/categories";

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  color: string | null;
  isDefault: boolean;
  createdAt: string;
}

export const listCategories = () => api.get<{ data: Category[] }>("/categories");
export const createCategory = (input: CreateCategoryInput) =>
  api.post<ItemResponse<Category>>("/categories", input);
export const updateCategory = (id: string, input: UpdateCategoryInput) =>
  api.patch<ItemResponse<Category>>(`/categories/${id}`, input);
export const deleteCategory = (id: string) => api.del<void>(`/categories/${id}`);
