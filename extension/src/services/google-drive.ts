export class GoogleDriveService {
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

    if (!accessToken) {
      const fakeId = `tailored-${company.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
      return {
        newDocId: fakeId,
        newDocName,
        webViewLink: `https://docs.google.com/document/d/${fakeId}/edit`
      };
    }

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${sourceDocId}/copy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newDocName })
      });

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

  public getPdfExportUrl(docId: string): string {
    return `https://docs.google.com/document/d/${docId}/export?format=pdf`;
  }
}
