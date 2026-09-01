import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/Users/minhnguyen/.gemini/antigravity-cli/brain/8e81a223-a291-45ef-af0e-d03771413dc8';
const EXTENSION_PATH = '/Users/minhnguyen/Desktop/Coding/resumehack/extension/dist';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USER_DATA_DIR = '/tmp/resumehack-test-profile-' + Date.now();

async function run() {
  console.log('[Test] Launching Chrome with extension from:', EXTENSION_PATH);
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    userDataDir: USER_DATA_DIR,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1200,900',
    ],
  });

  try {
    // Open chrome://extensions to find extension ID
    const extPage = await browser.newPage();
    await extPage.goto('chrome://extensions', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));

    // Discover targets
    const targets = await browser.targets();
    let extensionId = null;
    for (const t of targets) {
      console.log(' - Discovered Target:', t.type(), t.url());
      if (t.url().startsWith('chrome-extension://')) {
        const match = t.url().match(/chrome-extension:\/\/([a-z0-9]+)/);
        if (match) {
          extensionId = match[1];
          break;
        }
      }
    }

    if (!extensionId) {
      // Evaluate in extensions page with developer mode or check items
      const devExtId = await extPage.evaluate(() => {
        try {
          const manager = document.querySelector('extensions-manager');
          const itemList = manager?.shadowRoot?.querySelector('extensions-item-list');
          const items = itemList?.shadowRoot?.querySelectorAll('extensions-item');
          if (items && items.length > 0) {
            return items[0].getAttribute('id');
          }
        } catch {}
        return null;
      });
      if (devExtId) extensionId = devExtId;
    }

    console.log('[Test] Resolved Extension ID:', extensionId);
    if (!extensionId) {
      throw new Error('Could not resolve extension ID from Chrome session');
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 450, height: 750 });

    const sidepanelUrl = `chrome-extension://${extensionId}/index.html`;
    console.log('[Test] Navigating to sidepanel:', sidepanelUrl);
    
    // Capture console messages
    const logs = [];
    page.on('console', (msg) => {
      const txt = `[Page Console ${msg.type()}] ${msg.text()}`;
      console.log(txt);
      logs.push(txt);
    });
    page.on('pageerror', (err) => {
      console.error('[Page Error]', err);
      logs.push(`[Page Error] ${err.toString()}`);
    });

    await page.goto(sidepanelUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));

    // Navigate to Settings tab
    console.log('[Test] Clicking Settings tab button...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('Settings') || b.getAttribute('title')?.includes('Settings') || b.querySelector('svg.lucide-settings') || b.innerHTML.includes('lucide-settings'));
      if (btn) btn.click();
    });

    await new Promise((r) => setTimeout(r, 1500));

    // Step 1a: Screenshot of Settings page
    const screenshot1Path = path.join(ARTIFACTS_DIR, 'screenshot_real_settings_tab_initial.png');
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log('[Test] Saved initial Settings screenshot to:', screenshot1Path);

    // Check if Connect Google Account button exists in the DOM
    const connectButtonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const connectBtn = buttons.find(b => b.textContent?.includes('Connect Google Account'));
      return {
        found: Boolean(connectBtn),
        text: connectBtn ? connectBtn.textContent : null,
        visible: connectBtn ? connectBtn.offsetParent !== null : false,
        allButtons: buttons.map(b => b.textContent?.trim()).filter(Boolean),
      };
    });
    console.log('[Test] Connect Button Search Result:', connectButtonInfo);

    // Step 1b: Click Connect Google Account button
    console.log('[Test] Clicking Connect Google Account button...');
    const clickResult = await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const connectBtn = buttons.find(b => b.textContent?.includes('Connect Google Account'));
      if (connectBtn) {
        connectBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    });
    console.log('[Test] Click evaluation:', clickResult);

    await new Promise((r) => setTimeout(r, 3000));

    // Screenshot after click
    const screenshot2Path = path.join(ARTIFACTS_DIR, 'screenshot_real_after_connect_click.png');
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log('[Test] Saved post-click screenshot to:', screenshot2Path);

    // Step 1c: Inspect chrome.storage.local
    const storageData = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(null, (items) => {
            resolve({
              keys: Object.keys(items || {}),
              hasGoogleAccessToken: Boolean(items?.google_access_token),
              googleAccessTokenLength: items?.google_access_token ? items.google_access_token.length : 0,
              googleUserEmail: items?.google_user_email || items?.resumehack_settings?.googleUserEmail || null,
              googleTokenExpiresAt: items?.google_token_expires_at || items?.resumehack_settings?.googleTokenExpiresAt || null,
              resumehackSettings: items?.resumehack_settings ? {
                ...items.resumehack_settings,
                googleAccessToken: items.resumehack_settings.googleAccessToken ? '[REDACTED_PRESENT]' : undefined,
              } : null,
              rawItemsSanitized: {
                ...items,
                google_access_token: items?.google_access_token ? '[REDACTED_PRESENT]' : undefined,
              }
            });
          });
        } else {
          resolve({ error: 'chrome.storage.local not available in context' });
        }
      });
    });

    console.log('[Test] chrome.storage.local inspection:', JSON.stringify(storageData, null, 2));

    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'real_browser_test_output.json'),
      JSON.stringify({ connectButtonInfo, clickResult, storageData, logs }, null, 2)
    );

  } finally {
    await browser.close();
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((err) => {
  console.error('[Test Error]', err);
  process.exit(1);
});
