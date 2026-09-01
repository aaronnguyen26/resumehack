import { GoogleDocsService } from './google-docs.js';

export class GoogleDriveService {
  private docsService = new GoogleDocsService();

  /**
   * Forks (duplicates) a Master Google Doc to create a tailored copy for a company.
   * Runs natively in browser via Google Drive API or client-side fork simulation.
   */
  public async forkDocument(
    sourceDocId: string,
    company: string,
    candidateName: string = 'Alex Chen',
    accessToken?: string
  ): Promise<{ newDocId: string; newDocName: string; webViewLink: string }> {
    const newDocName = `${company} - Resume - ${candidateName}`;

    if (!accessToken && !(await this.docsService.getAuthToken(false))) {
      const fakeId = `tailored-${company.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
      return {
        newDocId: fakeId,
        newDocName,
        webViewLink: `https://docs.google.com/document/d/${fakeId}/edit`
      };
    }

    try {
      const response = await this.docsService.fetchWithGoogleAuth(
        `https://www.googleapis.com/drive/v3/files/${sourceDocId}/copy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newDocName })
        },
        accessToken
      );

      const data = await response.json();
      return {
        newDocId: data.id || `tailored-${Date.now()}`,
        newDocName,
        webViewLink: data.webViewLink || `https://docs.google.com/document/d/${data.id}/edit`
      };
    } catch (err) {
      console.error('Drive copy error, using fallback link:', err);
      const fallbackId = `tailored-${company.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
      return {
        newDocId: fallbackId,
        newDocName,
        webViewLink: `https://docs.google.com/document/d/${fallbackId}/edit`
      };
    }
  }

  /**
   * Exports the Google Doc as a PDF ArrayBuffer via Google Drive API / docs export with 401 retry.
   */
  public async exportDocumentAsPdf(
    documentId: string,
    accessToken?: string
  ): Promise<ArrayBuffer> {
    try {
      const res = await this.docsService.fetchWithGoogleAuth(
        `https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=application/pdf`,
        {},
        accessToken
      );
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch (err) {
      console.debug('[GoogleDriveService] Drive files.export note, trying direct doc export...', err);
    }

    // Direct Google Docs PDF export endpoint fallback
    const fallbackRes = await this.docsService.fetchWithGoogleAuth(
      `https://docs.google.com/document/d/${documentId}/export?format=pdf`,
      {},
      accessToken
    );

    if (!fallbackRes.ok) {
      const errData = await fallbackRes.json().catch(() => ({}));
      const rawMsg = errData?.error?.message || '';
      if (fallbackRes.status === 404 || fallbackRes.status === 403 || rawMsg.toLowerCase().includes('not found') || rawMsg.toLowerCase().includes('permission')) {
        throw new Error(`Google Drive PDF export error: This document has not been authorized under the 'drive.file' scope. Please open Settings and click 'Select from Google Drive' via the Google Picker to authorize access.`);
      }
      throw new Error(rawMsg || `Failed to export PDF (HTTP ${fallbackRes.status})`);
    }

    return await fallbackRes.arrayBuffer();
  }

  public getPdfExportUrl(docId: string): string {
    return `https://docs.google.com/document/d/${docId}/export?format=pdf`;
  }
}
