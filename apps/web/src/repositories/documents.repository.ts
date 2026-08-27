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
  async getDocumentsForEntity(entityType: string, entityId: string): Promise<DocumentRecord[]> {
    try {
      const response = await apiClient.get(`/documents/entity/${entityType}/${entityId}`);
      return response.data;
    } catch (err) {
      return [];
    }
  },

  async uploadDocument(file: File, entityType: string, entityId: string): Promise<DocumentRecord> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);

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
