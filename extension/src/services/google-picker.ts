// Google Picker API Integration for Selecting Google Docs under drive.file scope

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

export interface GoogleDocPickerResult {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  lastEditedUtc?: number;
}

export interface GooglePickerOptions {
  accessToken: string;
  appId?: string;
  developerKey?: string;
  onPicked: (doc: GoogleDocPickerResult) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

let gapiLoadingPromise: Promise<void> | null = null;

export async function loadGooglePickerApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.google?.picker && window.gapi) return;

  if (gapiLoadingPromise) return gapiLoadingPromise;

  gapiLoadingPromise = new Promise((resolve, reject) => {
    // Check if gapi script is already in document
    const existingScript = document.getElementById('google-api-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-api-script';
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.gapi) {
          window.gapi.load('picker', {
            callback: () => resolve(),
            onerror: (err: any) => reject(new Error('Failed to load Google Picker module: ' + (err?.message || 'unknown'))),
          });
        } else {
          reject(new Error('Google API client (gapi) failed to initialize'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Google API script (https://apis.google.com/js/api.js)'));
      document.head.appendChild(script);
    } else if (window.gapi) {
      window.gapi.load('picker', {
        callback: () => resolve(),
        onerror: (err: any) => reject(new Error('Failed to load Google Picker module: ' + (err?.message || 'unknown'))),
      });
    } else {
      existingScript.addEventListener('load', () => {
        if (window.gapi) {
          window.gapi.load('picker', {
            callback: () => resolve(),
            onerror: (err: any) => reject(new Error('Failed to load Google Picker module: ' + (err?.message || 'unknown'))),
          });
        } else {
          reject(new Error('gapi not loaded'));
        }
      });
    }
  });

  return gapiLoadingPromise;
}

/**
 * Opens Google Picker modal scoped to Google Docs documents.
 * Automatically grants `drive.file` scope authorization to the chosen document upon selection.
 */
export async function openGoogleDocPicker(options: GooglePickerOptions): Promise<void> {
  try {
    await loadGooglePickerApi();

    if (!window.google?.picker) {
      throw new Error('Google Picker API is unavailable');
    }

    const { accessToken, onPicked, onCancel, onError } = options;

    const docsView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCUMENTS)
      .setMimeTypes('application/vnd.google-apps.document')
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const builder = new window.google.picker.PickerBuilder()
      .setTitle('Select Master Resume Google Doc')
      .setOAuthToken(accessToken)
      .addView(docsView)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          if (doc) {
            onPicked({
              id: doc.id,
              name: doc.name,
              url: doc.url || `https://docs.google.com/document/d/${doc.id}/edit`,
              mimeType: doc.mimeType,
              lastEditedUtc: doc.lastEditedUtc,
            });
          }
        } else if (data.action === window.google.picker.Action.CANCEL) {
          onCancel?.();
        }
      });

    if (options.appId) {
      builder.setAppId(options.appId);
    }
    if (options.developerKey) {
      builder.setDeveloperKey(options.developerKey);
    }

    const picker = builder.build();
    picker.setVisible(true);
  } catch (err: any) {
    console.error('[GooglePicker] Failed to launch picker:', err);
    options.onError?.(err);
  }
}
