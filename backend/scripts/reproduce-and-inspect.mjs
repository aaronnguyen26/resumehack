import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/Users/minhnguyen/.gemini/antigravity-cli/brain/185b9094-9925-4efc-b089-9ea85fef88b5';
const EXTENSION_PATH = '/Users/minhnguyen/Desktop/Coding/resumehack/extension/dist';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USER_DATA_DIR = '/tmp/resumehack-test-profile-' + Date.now();

async function run() {
  console.log('================================================================');
  console.log('[Step 0 & 1] Launching real Google Chrome with extension from:', EXTENSION_PATH);
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    userDataDir: USER_DATA_DIR,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,900',
    ],
  });

  try {
    // 1. Wait for extension to initialize and find extension ID
    const extPage = await browser.newPage();
    await extPage.goto('chrome://extensions', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));

    const targets = await browser.targets();
    let extensionId = null;
    let serviceWorkerTarget = null;

    for (const t of targets) {
      console.log(`[Discovered Target] Type: ${t.type()} | URL: ${t.url()}`);
      if (t.url().startsWith('chrome-extension://')) {
        const match = t.url().match(/chrome-extension:\/\/([a-z0-9]+)/);
        if (match) {
          extensionId = match[1];
        }
      }
      if (t.type() === 'service_worker' && t.url().includes('background')) {
        serviceWorkerTarget = t;
      }
    }

    if (!extensionId) {
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

    console.log('[Step 0] Freshly loaded Extension ID:', extensionId);
    if (!extensionId) {
      throw new Error('Could not resolve extension ID');
    }

    // Connect to background service worker console if available
    let swWorker = null;
    if (serviceWorkerTarget) {
      swWorker = await serviceWorkerTarget.worker();
      console.log('[Step 0] Connected to background service worker target.');
    }

    // 2. Open Extension Sidepanel / Main UI
    const sidepanelPage = await browser.newPage();
    await sidepanelPage.setViewport({ width: 480, height: 800 });

    const sidepanelUrl = `chrome-extension://${extensionId}/index.html`;
    console.log('[Step 1] Navigating to sidepanel:', sidepanelUrl);

    const pageLogs = [];
    const networkCalls = [];

    sidepanelPage.on('console', (msg) => {
      const txt = `[Sidepanel Console ${msg.type()}] ${msg.text()}`;
      console.log(txt);
      pageLogs.push(txt);
    });

    sidepanelPage.on('pageerror', (err) => {
      const txt = `[Sidepanel Error] ${err.toString()}`;
      console.error(txt);
      pageLogs.push(txt);
    });

    sidepanelPage.on('request', (req) => {
      if (req.url().includes('googleapis.com')) {
        networkCalls.push({
          type: 'request',
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postData: req.postData(),
        });
        console.log(`[Network Request] ${req.method()} ${req.url()}`, {
          hasAuth: Boolean(req.headers()['authorization']),
        });
      }
    });

    sidepanelPage.on('response', async (res) => {
      if (res.url().includes('googleapis.com')) {
        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch {}
        networkCalls.push({
          type: 'response',
          url: res.url(),
          status: res.status(),
          headers: res.headers(),
          body: bodyText,
        });
        console.log(`[Network Response] ${res.status()} ${res.url()}`, bodyText.slice(0, 300));
      }
    });

    await sidepanelPage.goto(sidepanelUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));

    // Navigate to Settings tab
    console.log('[Step 1a] Navigating to Settings tab...');
    await sidepanelPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const settingsBtn = buttons.find(b => 
        b.textContent?.includes('Settings') || 
        b.getAttribute('title')?.includes('Settings') || 
        b.innerHTML.includes('lucide-settings')
      );
      if (settingsBtn) {
        settingsBtn.click();
      }
    });

    await new Promise((r) => setTimeout(r, 1000));

    // Step 1a: Take screenshot of Settings page
    const screenshot1aPath = path.join(ARTIFACTS_DIR, 'screenshot_step1a_settings_initial.png');
    await sidepanelPage.screenshot({ path: screenshot1aPath, fullPage: true });
    console.log('[Step 1a] Saved screenshot to:', screenshot1aPath);

    // Inspect rendered DOM for Connect button
    const renderedSettingsDom = await sidepanelPage.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        visible: b.offsetParent !== null,
        className: b.className,
      }));
      const textContent = document.body.innerText;
      return { allButtons, textContentPreview: textContent.slice(0, 1000) };
    });

    console.log('[Step 1a] Rendered Buttons:', renderedSettingsDom.allButtons);

    // Step 1b: Click Connect Google Account
    console.log('[Step 1b] Attempting to click "Connect Google Account" button...');
    const clickResult = await sidepanelPage.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const connectBtn = buttons.find(b => b.textContent?.includes('Connect Google Account'));
      if (connectBtn) {
        connectBtn.click();
        return { found: true, clicked: true, text: connectBtn.textContent?.trim() };
      }
      return { found: false, clicked: false };
    });

    console.log('[Step 1b] Click Result:', clickResult);

    // Wait for OAuth dialog / message update
    await new Promise((r) => setTimeout(r, 3500));

    // Step 1b: Take screenshot after click
    const screenshot1bPath = path.join(ARTIFACTS_DIR, 'screenshot_step1b_after_connect_click.png');
    await sidepanelPage.screenshot({ path: screenshot1bPath, fullPage: true });
    console.log('[Step 1b] Saved post-click screenshot to:', screenshot1bPath);

    // Step 1c: Inspect chrome.storage.local
    const storageInspection = await sidepanelPage.evaluate(() => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(null, (items) => {
            const sanitized = {};
            for (const [k, v] of Object.entries(items || {})) {
              if (typeof v === 'string' && (k.includes('token') || k.includes('key'))) {
                sanitized[k] = `[PRESENT string len=${v.length}, startsWith=${v.slice(0, 6)}...]`;
              } else if (typeof v === 'object' && v !== null) {
                sanitized[k] = JSON.parse(JSON.stringify(v));
                if (sanitized[k].googleAccessToken) {
                  sanitized[k].googleAccessToken = `[PRESENT string len=${sanitized[k].googleAccessToken.length}]`;
                }
                if (sanitized[k].googleRefreshToken) {
                  sanitized[k].googleRefreshToken = `[PRESENT string len=${sanitized[k].googleRefreshToken.length}]`;
                }
              } else {
                sanitized[k] = v;
              }
            }
            resolve({
              allKeys: Object.keys(items || {}),
              rawItemsSanitized: sanitized,
            });
          });
        } else {
          resolve({ error: 'chrome.storage.local not available' });
        }
      });
    });

    console.log('[Step 1c] chrome.storage.local Inspection:', JSON.stringify(storageInspection, null, 2));

    // Step 1d: Trigger an Apply to Doc action and capture Network request
    console.log('[Step 1d] Triggering apply-to-doc action...');
    const applyResult = await sidepanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage(
            {
              type: 'APPLY_DIFFS_TO_DOC',
              docId: '1A2b3C4d5E6F7g8H9i0J_AlexChen_Master',
              diffs: [
                {
                  id: 'diff-1',
                  originalBullet: '• Engineered microservices using Python',
                  tailoredBullet: '• Engineered high-performance microservices using TypeScript and Python, improving throughput by 42%',
                  section: 'Experience',
                  status: 'accepted'
                }
              ]
            },
            (response) => {
              resolve({
                runtimeLastError: chrome.runtime.lastError?.message || null,
                response,
              });
            }
          );
        } else {
          resolve({ error: 'chrome.runtime.sendMessage not available' });
        }
      });
    });

    console.log('[Step 1d] Apply Result:', JSON.stringify(applyResult, null, 2));

    // Wait for any network requests to settle
    await new Promise((r) => setTimeout(r, 2000));

    console.log('[Step 1d] Captured Google API Network Calls:', JSON.stringify(networkCalls, null, 2));

    // Save summary json
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'step1_reproduction_output.json'),
      JSON.stringify({
        extensionId,
        renderedSettingsDom,
        clickResult,
        storageInspection,
        applyResult,
        networkCalls,
        pageLogs,
      }, null, 2)
    );

  } finally {
    await browser.close();
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((err) => {
  console.error('[Reproduction Script Error]', err);
  process.exit(1);
});
