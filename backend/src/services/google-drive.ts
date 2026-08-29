import { google } from 'googleapis';

export class GoogleDriveService {
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

    if (!accessToken) {
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
   * Generates a direct PDF export URL or downloads the PDF buffer from Google Drive.
   */
  public getPdfExportUrl(docId: string): string {
    return `https://docs.google.com/document/d/${docId}/export?format=pdf`;
  }
}
