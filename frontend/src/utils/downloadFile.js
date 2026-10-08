import api from '../api/axios';
import { showErrorToast } from './toast';

/**
 * Downloads a medical document file using the authorized backend endpoint.
 * Preserves the original file name and format without exposing raw storage URLs.
 */
export const handleDownload = async (target, customFileName) => {
  if (!target) return;

  try {
    let downloadUrl = '';
    let defaultName = customFileName || 'medical-document';

    // If target is a record object
    if (typeof target === 'object' && target !== null) {
      const recordId = target._id || target.id;
      defaultName = customFileName || target.file?.fileName || target.title || 'medical-document';
      if (recordId) {
        downloadUrl = `/medical-record/${recordId}/download`;
      } else {
        downloadUrl = target.fileUrl || target.file?.url || '';
      }
    } else if (typeof target === 'string') {
      if (/^[0-9a-fA-F]{24}$/.test(target)) {
        downloadUrl = `/medical-record/${target}/download`;
      } else {
        downloadUrl = target;
      }
    }

    if (!downloadUrl) {
      showErrorToast('Download link is not available.');
      return;
    }

    // If using the backend authorized download route
    if (downloadUrl.startsWith('/')) {
      const response = await api.get(downloadUrl, {
        responseType: 'blob'
      });

      // Extract filename from Content-Disposition header if present
      let resolvedFileName = defaultName;
      const disposition = response.headers?.['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          resolvedFileName = match[1].trim();
        }
      }

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = resolvedFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      return;
    }

    // External URL fallback
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('[Download Error]:', err.message);
    showErrorToast(err.message || 'Failed to download file. Please try again.');
  }
};
