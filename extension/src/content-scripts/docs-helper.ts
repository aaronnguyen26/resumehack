// Live Screen & Resume Document Reader Content Script

function extractVisibleScreenText(): { title: string; fullText: string; url: string; isGoogleDoc: boolean; selection?: string } {
  const url = window.location.href;
  const isGoogleDoc = url.includes('docs.google.com/document/d/');
  let title = document.title.replace(' - Google Docs', '').trim();
  let fullText = '';

  if (isGoogleDoc) {
    // 1. Google Docs specific canvas & DOM text layer extraction
    const docTitleInput = document.querySelector('.docs-title-input') as HTMLInputElement;
    if (docTitleInput && docTitleInput.value) {
      title = docTitleInput.value;
    }

    // Try extracting from Google Docs lineviews / paragraph renderers
    const lineViews = document.querySelectorAll('.kix-lineview-text-block, .kix-paragraphrenderer, .kix-page-content');
    if (lineViews.length > 0) {
      const extractedLines: string[] = [];
      lineViews.forEach((el) => {
        const t = el.textContent?.trim();
        if (t && t.length > 0) {
          extractedLines.push(t);
        }
      });
      fullText = extractedLines.join('\n');
    }
  }

  // Fallback / Generic document screen extraction (Word Online, Overleaf, Notion, PDF viewer, Web resume)
  if (!fullText || fullText.length < 50) {
    const mainContent = document.querySelector('main, article, [role="main"], #content, .document-editor, .notion-page-content');
    if (mainContent) {
      fullText = (mainContent as HTMLElement).innerText;
    } else {
      fullText = document.body.innerText;
    }
  }

  const selection = window.getSelection()?.toString().trim() || undefined;

  return {
    title: title || 'Active Document Screen',
    fullText: fullText.slice(0, 15000), // Clean limit
    url,
    isGoogleDoc,
    selection
  };
}

function notifyScreenResume() {
  const data = extractVisibleScreenText();
  if (data.fullText.length > 30) {
    chrome.runtime.sendMessage({
      type: 'SCREEN_RESUME_DETECTED',
      data: {
        docId: data.isGoogleDoc ? (window.location.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1] || 'active-doc') : 'screen-doc',
        title: data.title,
        fullText: data.fullText,
        url: data.url,
        isGoogleDoc: data.isGoogleDoc,
        selection: data.selection,
        lastSynced: new Date().toISOString()
      }
    });

    injectFloatingScreenBadge(data.title, data.isGoogleDoc);
  }
}

function injectFloatingScreenBadge(title: string, isGoogleDoc: boolean) {
  if (document.getElementById('resumehack-screen-badge')) return;

  const badge = document.createElement('div');
  badge.id = 'resumehack-screen-badge';
  badge.style.cssText = `
    position: fixed;
    top: ${isGoogleDoc ? '60px' : '20px'};
    right: ${isGoogleDoc ? '180px' : '20px'};
    z-index: 999999;
    background: #4F46E5;
    color: #FFFFFF;
    padding: 7px 14px;
    border-radius: 9999px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    transition: all 0.2s ease;
  `;

  badge.innerHTML = `
    <span style="width: 7px; height: 7px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
    <span>ResumeHack: Screen Connected</span>
  `;

  badge.title = `Reading "${title}". Click to open ResumeHack Copilot side panel.`;
  badge.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
  });

  document.body.appendChild(badge);
}

// Listen for direct request from side panel to capture screen text
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'READ_SCREEN_NOW') {
    const data = extractVisibleScreenText();
    sendResponse({ success: true, data });
  }
  return true;
});

// Run extraction on load and on text selection change
setTimeout(notifyScreenResume, 1200);

document.addEventListener('selectionchange', () => {
  const selectedText = window.getSelection()?.toString().trim();
  if (selectedText && selectedText.length > 10) {
    chrome.runtime.sendMessage({
      type: 'SCREEN_SELECTION_UPDATED',
      data: selectedText
    });
  }
});
