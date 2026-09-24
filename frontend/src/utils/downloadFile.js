export const handleDownload = async (fileUrl, fileName) => {
  if (!fileUrl) return;

  try {
    const response = await fetch(fileUrl);
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName || 'medical-document';

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    // Fallback direct link trigger if fetch fails
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'medical-document';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
