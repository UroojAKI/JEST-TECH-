import { apiClient } from '../lib/api-client';

export interface DocumentRecord {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  entityType: string;
  entityId: string;
  uploadedAt: string;
}

export const documentsRepository = {
  async getAllDocuments(params?: any): Promise<{ data: DocumentRecord[]; total: number }> {
    try {
      const response = await apiClient.get('/documents', { params });
      return response.data;
    } catch (err) {
      return { data: [], total: 0 };
    }
  },

  async getDocumentsForEntity(entityType: string, entityId: string): Promise<DocumentRecord[]> {
    try {
      const response = await apiClient.get(`/documents/entity/${entityType}/${entityId}`);
      return response.data;
    } catch (err) {
      return [];
    }
  },

  async uploadDocument(
    file: File,
    entityType: string,
    entityId: string,
    extra?: { name?: string; category?: string; tags?: string }
  ): Promise<DocumentRecord> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    if (extra?.name) formData.append('name', extra.name);
    if (extra?.category) formData.append('category', extra.category);
    if (extra?.tags) formData.append('tags', extra.tags);

    const response = await apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async downloadDocument(documentId: string): Promise<Blob> {
    const response = await apiClient.get(`/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async deleteDocument(documentId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/documents/${documentId}`);
    return response.data;
  },

  async startReview(documentId: string): Promise<any> {
    const response = await apiClient.post(`/documents/${documentId}/review`);
    return response.data;
  },

  async verifyDocument(
    documentId: string,
    data: { status: 'VERIFIED' | 'REJECTED'; rejectionReason?: string; notes?: string },
  ): Promise<any> {
    const response = await apiClient.post(`/documents/${documentId}/verify`, data);
    return response.data;
  },

  async getVerificationStatus(documentId: string): Promise<any> {
    const response = await apiClient.get(`/documents/${documentId}/verification`);
    return response.data;
  },
};
