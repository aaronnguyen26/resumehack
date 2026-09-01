import { google } from 'googleapis';
import { GoogleDocsService } from './google-docs.js';

export class GoogleDriveService {
  private docsService = new GoogleDocsService();

  /**
   * Forks (duplicates) a Master Google Doc to create a tailored copy for a company.
   */
  public async forkDocument(
    sourceDocId: string,
    company: string,
    candidateName: string = 'Alex Chen',
    accessToken?: string
  ): Promise<{ newDocId: string; newDocName: string; webViewLink: string }> {
    const newDocName = `${company} - Resume - ${candidateName}`;

    if (!accessToken && !(await this.docsService.getAuthToken(false))) {
      // Mocked Drive response for preview/offline workflows
      const fakeId = `tailored-${company.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
      return {
        newDocId: fakeId,
        newDocName,
        webViewLink: `https://docs.google.com/document/d/${fakeId}/edit`
      };
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });

    const copyResponse = await drive.files.copy({
      fileId: sourceDocId,
      requestBody: {
        name: newDocName
      },
      fields: 'id, name, webViewLink'
    });

    return {
      newDocId: copyResponse.data.id || '',
      newDocName: copyResponse.data.name || newDocName,
      webViewLink: copyResponse.data.webViewLink || `https://docs.google.com/document/d/${copyResponse.data.id}/edit`
    };
  }

  /**
   * Exports the Google Doc directly as a PDF binary buffer using Google Drive API v3 files.export with automatic 401 retry.
   */
  public async exportDocumentAsPdf(
    documentId: string,
    accessToken?: string
  ): Promise<Buffer> {
    try {
      const res = await this.docsService.fetchWithGoogleAuth(
        `https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=application/pdf`,
        {},
        accessToken
      );

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch (driveErr) {
      console.debug('[GoogleDriveService Backend] Drive files.export note, trying direct doc export...', driveErr);
    }

    // Direct Google Docs PDF export endpoint fallback
    const fallbackRes = await this.docsService.fetchWithGoogleAuth(
      `https://docs.google.com/document/d/${documentId}/export?format=pdf`,
      {},
      accessToken
    );

    if (!fallbackRes.ok) {
      const errData = await fallbackRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to export PDF from Google Drive (HTTP ${fallbackRes.status})`);
    }

    const arrayBuf = await fallbackRes.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  /**
   * Generates a direct PDF export URL or downloads the PDF buffer from Google Drive.
   */
  public getPdfExportUrl(docId: string): string {
    return `https://docs.google.com/document/d/${docId}/export?format=pdf`;
  }
}
