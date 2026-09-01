import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Check, 
  Key, 
  User, 
  FileText, 
  Cloud, 
  LogOut, 
  RefreshCw, 
  AlertCircle, 
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { 
  getStoredSettings, 
  saveStoredSettings, 
  getGoogleAccessToken, 
  setGoogleAccessToken, 
  removeGoogleAccessToken,
  refreshGoogleAccessToken
} from '../../services/storage.js';
import {
  authenticateGoogleAccount,
  launchGoogleWebAuthFlow,
  getRedirectUri
} from '../../services/google-auth.js';
import { 
  getAiSettings, 
  saveAiSettings, 
  removeAiSettings,
  EMBEDDED_GEMINI_API_KEY,
  AiProvider,
  AiSettings
} from '../../services/ai-tailor.js';
import { openGoogleDocPicker } from '../../services/google-picker.js';
import { PROVIDER_MODEL_PRESETS } from '../../types/index.js';

export const SettingsTab: React.FC = () => {
  const [masterDocId, setMasterDocId] = useState('1A2b3C4d5E6F7g8H9i0J_AlexChen_Master');
  const [candidateName, setCandidateName] = useState('Alex Chen');
  const [targetTitle, setTargetTitle] = useState('Software Engineer');
  const [strictAntiHallucination, setStrictAntiHallucination] = useState(true);
  
  // Google Picker State
  const [isOpeningPicker, setIsOpeningPicker] = useState(false);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
  const [pickerMessage, setPickerMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showManualDocInput, setShowManualDocInput] = useState(false);

  // OAuth & Custom Token State
  const [connectionMode, setConnectionMode] = useState<'refresh_token' | 'access_token'>('refresh_token');
  const [refreshToken, setRefreshToken] = useState('');
  const [customToken, setCustomToken] = useState('');
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [authStatus, setAuthStatus] = useState<'connected' | 'permanent_token' | 'custom_token' | 'not_connected'>('not_connected');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [saved, setSaved] = useState(false);

  // AI API Key State
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiKeyStatus, setAiKeyStatus] = useState<'saved' | 'not_set'>('not_set');
  const [aiMessage, setAiMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isTestingAiKey, setIsTestingAiKey] = useState(false);

  const fetchUserInfo = async (token: string): Promise<string | null> => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const u = await res.json();
        const email = u.email || u.name;
        if (email) {
          setConnectedEmail(email);
          await saveStoredSettings({ googleUserEmail: email });
          return email;
        }
      }
    } catch (err) {
      console.debug('[SettingsTab] userinfo lookup note:', err);
    }
    return null;
  };

  useEffect(() => {
    // Load stored settings, custom token, and AI settings
    getStoredSettings().then(async (settings) => {
      if (settings.masterDocId) setMasterDocId(settings.masterDocId);
      if (settings.candidateName) setCandidateName(settings.candidateName);
      if (settings.targetTitle) setTargetTitle(settings.targetTitle);
      if (settings.strictAntiHallucination !== undefined) {
        setStrictAntiHallucination(settings.strictAntiHallucination);
      }
      if (settings.googleUserEmail) {
        setConnectedEmail(settings.googleUserEmail);
      }

      if (settings.googleRefreshToken) {
        setRefreshToken(settings.googleRefreshToken);
        setCustomToken(settings.googleAccessToken || '');
        setAuthStatus('connected');
        if (settings.googleAccessToken) {
          fetchUserInfo(settings.googleAccessToken);
        }
      } else if (settings.googleAccessToken) {
        setCustomToken(settings.googleAccessToken);
        setAuthStatus('connected');
        fetchUserInfo(settings.googleAccessToken);
      } else {
        checkSilentChromeOAuth();
      }
    });

    getAiSettings().then((aiSettings) => {
      if (aiSettings?.provider) {
        setAiProvider(aiSettings.provider);
        setAiApiKey(aiSettings.apiKey || '');
        setAiModel(aiSettings.model || '');
        setAiBaseUrl(aiSettings.baseUrl || '');
        if (aiSettings.apiKey || aiSettings.provider === 'ollama') {
          setAiKeyStatus('saved');
        }
      }
    });
  }, []);

  const checkSilentChromeOAuth = () => {
    if (typeof chrome !== 'undefined' && chrome.identity?.getAuthToken) {
      chrome.identity.getAuthToken({ interactive: false }, async (tok) => {
        if (!chrome.runtime?.lastError && tok) {
          const tokenStr = tok as string;
          await setGoogleAccessToken(tokenStr, 3300);
          setAuthStatus('connected');
          await fetchUserInfo(tokenStr);
        } else {
          setAuthStatus((prev) => (prev === 'custom_token' || prev === 'permanent_token' ? prev : 'not_connected'));
        }
      });
    }
  };

  // 1. Universal Google OAuth (Native getAuthToken for Chrome, launchWebAuthFlow + PKCE for Comet/Brave/Edge)
  const handleInteractiveAuthorize = async () => {
    setIsAuthorizing(true);
    setAuthMessage(null);

    try {
      const res = await authenticateGoogleAccount(true);
      setIsAuthorizing(false);

      if (res.success && res.accessToken) {
        setCustomToken(res.accessToken);
        setAuthStatus('connected');
        const email = res.email || (await fetchUserInfo(res.accessToken)) || 'Google Account';
        setConnectedEmail(email);
        setAuthMessage({
          text: `✅ Connected as ${email}! Docs & Drive permissions authorized (${res.method === 'launchWebAuthFlow' ? 'Web Auth Flow' : 'Chrome OAuth'}).`,
          type: 'success'
        });
        setTimeout(() => setAuthMessage(null), 6000);
      } else {
        const rawErrMsg = res.error || 'OAuth authorization window was closed or canceled.';
        console.error('[ResumeHack Settings] OAuth authorization error:', rawErrMsg, res.rawError);

        let extraHint = '';
        if (rawErrMsg.toLowerCase().includes('client') || rawErrMsg.toLowerCase().includes('oauth2')) {
          extraHint = ` (Authorized redirect URI: ${getRedirectUri()} — verify in Google Cloud Console).`;
        } else if (rawErrMsg.toLowerCase().includes('access_denied') || rawErrMsg.toLowerCase().includes('permission') || rawErrMsg.toLowerCase().includes('blocked')) {
          extraHint = ' (If in Testing mode in Cloud Console, add your email under Audience -> Test Users).';
        }

        setAuthMessage({
          text: `⚠️ OAuth Error: "${rawErrMsg}"${extraHint}`,
          type: 'error'
        });
      }
    } catch (err: any) {
      setIsAuthorizing(false);
      console.error('[ResumeHack Settings] OAuth exception:', err);
      setAuthMessage({
        text: `⚠️ OAuth Exception: ${err.message || 'Error during authorization'}`,
        type: 'error'
      });
    }
  };

  // 2. Disconnect Google OAuth (Full Cache + Storage Clearance)
  const handleDisconnect = async () => {
    setAuthMessage(null);
    if (typeof chrome !== 'undefined' && chrome.identity) {
      const stored = await getStoredSettings();
      const tok = stored.googleAccessToken || customToken;
      if (tok && chrome.identity.removeCachedAuthToken) {
        chrome.identity.removeCachedAuthToken({ token: tok }, () => {});
      }
      chrome.identity.getAuthToken({ interactive: false }, (activeTok) => {
        if (activeTok && chrome.identity.removeCachedAuthToken) {
          chrome.identity.removeCachedAuthToken({ token: activeTok }, () => {});
        }
      });
    }
    await removeGoogleAccessToken();
    await saveStoredSettings({ googleRefreshToken: '', googleUserEmail: '', googleAccessToken: '' });
    setCustomToken('');
    setRefreshToken('');
    setConnectedEmail(null);
    setAuthStatus('not_connected');
    setAuthMessage({
      text: 'Disconnected Google Account and cleared stored credentials.',
      type: 'info'
    });
    setTimeout(() => setAuthMessage(null), 4000);
  };

  // 3. Save Permanent Refresh Token (Never Expires)
  const handleSaveRefreshToken = async () => {
    const trimmed = refreshToken.trim();
    if (!trimmed) {
      await saveStoredSettings({ googleRefreshToken: '' });
      setAuthStatus('not_connected');
      setAuthMessage({
        text: 'Cleared refresh token.',
        type: 'info'
      });
      return;
    }

    setIsTestingToken(true);
    setAuthMessage(null);

    try {
      // Test exchanging the refresh token for a live access token
      const res = await refreshGoogleAccessToken(trimmed);
      if (res.success && res.accessToken) {
        setAuthStatus('permanent_token');
        setCustomToken(res.accessToken);
        const email = await fetchUserInfo(res.accessToken);
        setAuthMessage({
          text: `🎉 Permanent Connection Active${email ? ` (${email})` : ''}! Verified with Google Docs API. Tokens auto-renew forever.`,
          type: 'success'
        });
      } else {
        setAuthMessage({
          text: `⚠️ Could not exchange refresh token: ${res.error || 'Check token'}. In OAuth Playground Step 2, ensure you clicked "Exchange authorization code for tokens" and copied the Refresh token field.`,
          type: 'error'
        });
      }
    } catch (err: any) {
      setAuthMessage({
        text: `⚠️ Error saving refresh token: ${err?.message || 'Network error'}`,
        type: 'error'
      });
    } finally {
      setIsTestingToken(false);
    }
  };

  // 4. Save Custom Access Token
  const handleSaveCustomToken = async () => {
    const trimmed = customToken.trim();
    if (trimmed) {
      await setGoogleAccessToken(trimmed, 3300);
      setAuthStatus('custom_token');
      const email = await fetchUserInfo(trimmed);
      setAuthMessage({
        text: `✨ Custom Google Access Token saved${email ? ` (${email})` : ''}! Note: Standard tokens expire in ~60m.`,
        type: 'success'
      });
    } else {
      await removeGoogleAccessToken();
      setAuthStatus('not_connected');
      checkSilentChromeOAuth();
      setAuthMessage({
        text: 'Cleared custom access token.',
        type: 'info'
      });
    }
    setTimeout(() => setAuthMessage(null), 4000);
  };

  // 5. Test Access Token Connection
  const handleTestTokenConnection = async () => {
    const tokenToTest = customToken.trim();
    if (!tokenToTest) {
      setAuthMessage({
        text: '⚠️ Please enter an access token to test.',
        type: 'error'
      });
      return;
    }

    setIsTestingToken(true);
    setAuthMessage(null);

    try {
      // 1. Verify token validity and inspect scopes via Google's tokeninfo endpoint
      let activeToken = tokenToTest;
      let tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(activeToken)}`);
      
      if (!tokenInfoRes.ok) {
        // If testing failed, attempt background auto-renewal if a refresh token is configured
        const settings = await getStoredSettings();
        const configuredRefresh = refreshToken.trim() || settings.googleRefreshToken;
        if (configuredRefresh) {
          const refreshRes = await refreshGoogleAccessToken(configuredRefresh);
          if (refreshRes.success && refreshRes.accessToken) {
            activeToken = refreshRes.accessToken;
            setCustomToken(activeToken);
            setAuthStatus('permanent_token');
            tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(activeToken)}`);
          }
        }
      }

      if (!tokenInfoRes.ok) {
        setAuthMessage({
          text: `⚠️ Invalid or Expired Token (HTTP ${tokenInfoRes.status}). Use the 1-Click Connect button above or configure a Permanent Refresh Token.`,
          type: 'error'
        });
        return;
      }

      const tokenInfo = await tokenInfoRes.json();
      const scopeStr = tokenInfo.scope || '';
      const hasDocumentsScope =
        scopeStr.includes('https://www.googleapis.com/auth/documents') ||
        scopeStr.includes('https://www.googleapis.com/auth/drive');

      if (!hasDocumentsScope) {
        setAuthMessage({
          text: `⚠️ Missing 'documents' scope! Your token only has: [${scopeStr}]. Please connect using the 1-Click Connect button or check 'https://www.googleapis.com/auth/documents' in OAuth Playground.`,
          type: 'error'
        });
        return;
      }

      // 2. Fetch user profile
      const userName = (await fetchUserInfo(activeToken)) || 'Google User';
      const expiresInSec = Number(tokenInfo.expires_in || 3600);
      const minutesLeft = Math.max(1, Math.round(expiresInSec / 60));
      await setGoogleAccessToken(activeToken, expiresInSec);
      setAuthStatus('custom_token');
      setAuthMessage({
        text: `✅ Valid Google Docs Token for ${userName}! Scopes: documents + drive. Expires in ~${minutesLeft} min.`,
        type: 'success'
      });
    } catch (err: any) {
      setAuthMessage({
        text: `⚠️ Network error testing token: ${err.message || 'Check connection'}`,
        type: 'error'
      });
    } finally {
      setIsTestingToken(false);
    }
  };

  // ── AI API Key Handlers ──────────────────────────────────────────────────────

  const handleSaveAiKey = async () => {
    const trimmedKey = aiApiKey.trim();
    if (!trimmedKey && aiProvider !== 'ollama') {
      await removeAiSettings();
      setAiKeyStatus('not_set');
      setAiMessage({ text: 'AI configuration removed. Using rule-based suggestions.', type: 'info' });
      setTimeout(() => setAiMessage(null), 3000);
      return;
    }
    const defaultModel = PROVIDER_MODEL_PRESETS[aiProvider]?.defaultModel || 'default';
    await saveAiSettings({
      provider: aiProvider,
      apiKey: trimmedKey,
      model: aiModel.trim() || defaultModel,
      baseUrl: aiBaseUrl.trim() || undefined,
    });
    setAiKeyStatus('saved');
    const providerName = PROVIDER_MODEL_PRESETS[aiProvider]?.label || aiProvider;
    setAiMessage({
      text: `✅ ${providerName} settings saved! AI-powered suggestions are active.`,
      type: 'success'
    });
    setTimeout(() => setAiMessage(null), 5000);
  };

  const handleTestAiKey = async () => {
    const trimmedKey = aiApiKey.trim() || (aiProvider === 'gemini' ? EMBEDDED_GEMINI_API_KEY : '');
    if (!trimmedKey && aiProvider !== 'ollama') {
      setAiMessage({ text: '⚠️ Enter an API key first.', type: 'error' });
      return;
    }

    setIsTestingAiKey(true);
    setAiMessage(null);

    try {
      if (aiProvider === 'gemini') {
        let rawModel = aiModel.trim() || PROVIDER_MODEL_PRESETS.gemini.defaultModel;
        let requestedModel = rawModel.replace(/^models\//, '').trim();
        const testCandidates = [requestedModel, 'gemini-3.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(Boolean);
        const uniqueTestModels = Array.from(new Set(testCandidates));

        let verifiedModel: string | null = null;
        let lastErrMsg = '';

        for (const m of uniqueTestModels) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': trimmedKey,
                },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: 'Reply {"status":"ok"}' }] }],
                  generationConfig: { maxOutputTokens: 20, responseMimeType: 'application/json' },
                }),
              }
            );
            if (res.ok) {
              verifiedModel = m;
              break;
            } else {
              const err = await res.json().catch(() => ({}));
              lastErrMsg = err?.error?.message || `HTTP ${res.status}`;
            }
          } catch (e: any) {
            lastErrMsg = e?.message || lastErrMsg;
          }
        }

        if (verifiedModel) {
          setAiMessage({ text: `✅ Google Gemini connection verified! Model: ${verifiedModel} (Active & Ready)`, type: 'success' });
        } else {
          setAiMessage({ text: `⚠️ Gemini API error: ${lastErrMsg}`, type: 'error' });
        }
      } else if (aiProvider === 'openai') {
        const model = aiModel.trim() || PROVIDER_MODEL_PRESETS.openai.defaultModel;
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say {"status":"ok"}' }],
            max_tokens: 20,
            response_format: { type: 'json_object' },
          }),
        });
        if (res.ok) {
          setAiMessage({ text: `✅ OpenAI connection verified! Model: ${model}`, type: 'success' });
        } else {
          const err = await res.json().catch(() => ({}));
          setAiMessage({ text: `⚠️ OpenAI error: ${err?.error?.message || `HTTP ${res.status}`}`, type: 'error' });
        }
      } else if (aiProvider === 'claude') {
        const model = aiModel.trim() || PROVIDER_MODEL_PRESETS.claude.defaultModel;
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': trimmedKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say ok' }],
            max_tokens: 10,
          }),
        });
        if (res.ok) {
          setAiMessage({ text: `✅ Anthropic Claude connection verified! Model: ${model}`, type: 'success' });
        } else {
          const err = await res.json().catch(() => ({}));
          setAiMessage({ text: `⚠️ Claude error: ${err?.error?.message || `HTTP ${res.status}`}`, type: 'error' });
        }
      } else if (aiProvider === 'deepseek') {
        const model = aiModel.trim() || PROVIDER_MODEL_PRESETS.deepseek.defaultModel;
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say {"status":"ok"}' }],
            max_tokens: 10,
            response_format: { type: 'json_object' },
          }),
        });
        if (res.ok) {
          setAiMessage({ text: `✅ DeepSeek connection verified! Model: ${model}`, type: 'success' });
        } else {
          const err = await res.json().catch(() => ({}));
          setAiMessage({ text: `⚠️ DeepSeek error: ${err?.error?.message || `HTTP ${res.status}`}`, type: 'error' });
        }
      } else if (aiProvider === 'ollama') {
        const baseUrl = aiBaseUrl.trim() || 'http://localhost:11434';
        const model = aiModel.trim() || PROVIDER_MODEL_PRESETS.ollama.defaultModel;
        const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const modelsAvailable = (data?.models || []).map((m: any) => m.name).join(', ');
          setAiMessage({
            text: `✅ Ollama connected at ${baseUrl}! Models available: ${modelsAvailable || model}`,
            type: 'success'
          });
        } else {
          setAiMessage({ text: `⚠️ Ollama returned HTTP ${res.status}. Verify Ollama is running.`, type: 'error' });
        }
      } else {
        const baseUrl = aiBaseUrl.trim() || 'https://api.openai.com/v1';
        const model = aiModel.trim() || 'default';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (trimmedKey) headers['Authorization'] = `Bearer ${trimmedKey}`;
        const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5,
          }),
        });
        if (res.ok) {
          setAiMessage({ text: `✅ Custom endpoint connection verified!`, type: 'success' });
        } else {
          setAiMessage({ text: `⚠️ Endpoint error: HTTP ${res.status}`, type: 'error' });
        }
      }
    } catch (err: any) {
      setAiMessage({ text: `⚠️ Network error: ${err.message}`, type: 'error' });
    } finally {
      setIsTestingAiKey(false);
      setTimeout(() => setAiMessage(null), 8000);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────

  const handleSavePreferences = async () => {
    await saveStoredSettings({
      masterDocId,
      candidateName,
      targetTitle,
      strictAntiHallucination,
      googleAccessToken: customToken.trim() || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      <div>
        <h2 className="font-headline font-bold text-sm text-slate-900">
          Settings & Master Resume
        </h2>
        <p className="text-[11px] text-slate-500">
          Configure your Google Docs integration and AI tailoring preferences.
        </p>
      </div>

      {/* Google Account Connection Card */}
      <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-brand-50 flex items-center justify-center text-brand-600">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-xs text-slate-900">
                Google Workspace Connection
              </h3>
              <p className="text-[10px] text-slate-500">
                Live Docs apply &amp; Drive visual PDF snapshots
              </p>
            </div>
          </div>

          {authStatus === 'permanent_token' && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Permanent Active</span>
            </span>
          )}
          {authStatus === 'connected' && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>OAuth Connected</span>
            </span>
          )}
          {authStatus === 'custom_token' && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-bold">
              Token Active (~60m)
            </span>
          )}
          {authStatus === 'not_connected' && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-mono font-bold">
              Not Connected
            </span>
          )}
        </div>

        {/* ── STATE A: CONNECTED ── */}
        {authStatus !== 'not_connected' ? (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-md space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-emerald-950 font-headline">
                    Connected as {connectedEmail || 'Google Workspace Account'}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-800 leading-tight">
                  Authorized for Google Docs (editing) &amp; Drive (PDF export snapshots).
                </p>
              </div>

              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[9px] font-semibold shrink-0">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60">
              <button
                type="button"
                onClick={handleInteractiveAuthorize}
                disabled={isAuthorizing}
                className="text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 underline flex items-center gap-1"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isAuthorizing ? 'animate-spin' : ''}`} />
                <span>Switch / Re-authorize Account</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                className="py-1 px-2.5 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-slate-700 border border-slate-200 rounded text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs"
              >
                <LogOut className="w-3 h-3 text-rose-500" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── STATE B: NOT CONNECTED (1-CLICK PRIMARY CTA) ── */
          <div className="space-y-2.5">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Connect your Google account to enable 1-click bullet tailoring inside Google Docs and visual PDF snapshot rendering.
            </p>

            <button
              type="button"
              onClick={handleInteractiveAuthorize}
              disabled={isAuthorizing}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 text-white rounded-stitch font-headline font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isAuthorizing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Opening Google OAuth...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Connect Google Account</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <Lock className="w-2.5 h-2.5" />
              <span>Uses Chrome's native OAuth picker with secure token storage.</span>
            </div>
          </div>
        )}

        {/* ── Collapsible Advanced Manual Token Mode (Dev / Headless) ── */}
        <div className="pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full py-1 text-left flex items-center justify-between text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <span>⚙️ Advanced: Manual OAuth Playground / Headless Token</span>
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-2">
              {/* Connection Mode Selector Tabs */}
              <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setConnectionMode('refresh_token')}
                  className={`flex-1 py-1 px-2 rounded text-center transition-all ${
                    connectionMode === 'refresh_token'
                      ? 'bg-white text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚡ Permanent Refresh Token
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMode('access_token')}
                  className={`flex-1 py-1 px-2 rounded text-center transition-all ${
                    connectionMode === 'access_token'
                      ? 'bg-white text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🕒 Raw Access Token (60m)
                </button>
              </div>

              {/* ── Mode A: Permanent Refresh Token ── */}
              {connectionMode === 'refresh_token' && (
                <div className="space-y-2.5 pt-1">
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-md p-2.5 text-[10px] text-emerald-950 space-y-1.5 leading-relaxed">
                    <div className="font-semibold text-emerald-900 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>Get a Permanent Token via OAuth Playground:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-0.5 text-emerald-900/90 pl-0.5">
                      <li>
                        Open{' '}
                        <a
                          href="https://developers.google.com/oauthplayground"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold underline hover:text-emerald-700 inline-flex items-center gap-0.5"
                        >
                          Google OAuth Playground <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </li>
                      <li>Under <strong>Step 1</strong>, select <code className="bg-emerald-100/80 px-1 py-0.2 rounded font-mono">.../auth/documents</code> and <code className="bg-emerald-100/80 px-1 py-0.2 rounded font-mono">.../auth/drive.readonly</code></li>
                      <li>Click <strong>Authorize APIs</strong> &amp; sign in with your Google account</li>
                      <li>In <strong>Step 2</strong>, click <strong>Exchange authorization code for tokens</strong></li>
                      <li>Copy the <strong>Refresh token</strong> (<code className="bg-emerald-100/80 px-1 py-0.2 rounded font-mono">1//0g...</code>) and paste below!</li>
                    </ol>
                  </div>

                  <div className="relative">
                    <input
                      type={showRefreshToken ? 'text' : 'password'}
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      placeholder="1//0gX_sample_permanent_refresh_token..."
                      className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-900 focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRefreshToken(!showRefreshToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showRefreshToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveRefreshToken}
                      disabled={isTestingToken || !refreshToken.trim()}
                      className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      {isTestingToken ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>Save Refresh Token</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Mode B: Quick Access Token ── */}
              {connectionMode === 'access_token' && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={customToken}
                      onChange={(e) => setCustomToken(e.target.value)}
                      placeholder="ya29.a0AfH6SM..."
                      className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-900 focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCustomToken}
                      className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-semibold transition-colors"
                    >
                      Save Token
                    </button>
                    <button
                      type="button"
                      onClick={handleTestTokenConnection}
                      disabled={isTestingToken || !customToken.trim()}
                      className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded text-[10px] font-semibold transition-colors flex items-center gap-1"
                    >
                      {isTestingToken ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                      <span>Test Connection</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status / Alert Banner */}
        {authMessage && (
          <div
            className={`p-2.5 rounded text-[11px] leading-relaxed flex items-start gap-1.5 ${
              authMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : authMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{authMessage.text}</span>
          </div>
        )}
      </div>

      {/* ── AI API Key Card ─────────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-violet-50 flex items-center justify-center text-violet-600">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-xs text-slate-900">
                AI Suggestion Engine
              </h3>
              <p className="text-[10px] text-slate-500">
                Gemini, OpenAI, Claude, DeepSeek, or Local Ollama
              </p>
            </div>
          </div>
          {aiKeyStatus === 'saved' ? (
            <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-mono font-bold">
              AI Active
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-bold">
              Rule-Based
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed">
          Connect your preferred LLM to generate high-impact, ATS-optimized STAR bullet rewrites with strict anti-hallucination guardrails.
        </p>

        {/* Provider selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700">AI Provider</label>
          <select
            value={aiProvider}
            onChange={(e) => {
              const prov = e.target.value as AiProvider;
              setAiProvider(prov);
              setAiModel(PROVIDER_MODEL_PRESETS[prov]?.defaultModel || '');
              if (prov === 'ollama') {
                setAiBaseUrl('http://localhost:11434');
              }
            }}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-violet-500 font-medium"
          >
            <option value="gemini">Google Gemini (Recommended — Free API)</option>
            <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
            <option value="claude">Anthropic Claude (Claude 3.5 Sonnet / Haiku)</option>
            <option value="deepseek">DeepSeek (DeepSeek-Chat, Reasoner)</option>
            <option value="ollama">Local Ollama (Offline / Private)</option>
            <option value="custom">Custom OpenAI-Compatible Endpoint</option>
          </select>
        </div>

        {/* Base URL row (for Ollama or Custom) */}
        {(aiProvider === 'ollama' || aiProvider === 'custom') && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">Base URL</label>
            <input
              type="text"
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
              placeholder={aiProvider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-900 focus:outline-none focus:border-violet-500"
            />
          </div>
        )}

        {/* Model dropdown / input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700">Model</label>
            <span className="text-[10px] text-slate-400">Default: {PROVIDER_MODEL_PRESETS[aiProvider]?.defaultModel}</span>
          </div>
          {PROVIDER_MODEL_PRESETS[aiProvider]?.models.length > 1 ? (
            <select
              value={aiModel || PROVIDER_MODEL_PRESETS[aiProvider]?.defaultModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-violet-500 font-mono text-[11px]"
            >
              {PROVIDER_MODEL_PRESETS[aiProvider]?.models.map((m) => {
                let label = m;
                if (m === 'gemini-3.5-flash-lite') {
                  label = 'gemini-3.5-flash-lite (Standard & Default · Free Plan)';
                } else if (m === 'gemini-3.6-flash-lite') {
                  label = 'gemini-3.6-flash-lite (Optional · High Speed)';
                }
                return (
                  <option key={m} value={m}>
                    {label}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={PROVIDER_MODEL_PRESETS[aiProvider]?.defaultModel || 'Model name'}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-900 focus:outline-none focus:border-violet-500"
            />
          )}
        </div>

        {/* API Key input (optional for local Ollama) */}
        {aiProvider !== 'ollama' && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
              <Key className="w-3 h-3 text-slate-500" />
              <span>{PROVIDER_MODEL_PRESETS[aiProvider]?.label} API Key</span>
            </label>
            <div className="relative">
              <input
                type={showAiKey ? 'text' : 'password'}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={PROVIDER_MODEL_PRESETS[aiProvider]?.placeholderKey || 'API Key…'}
                className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-900 focus:outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={() => setShowAiKey(!showAiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                {showAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {PROVIDER_MODEL_PRESETS[aiProvider]?.keyUrl && (
              <p className="text-[10px] text-slate-400">
                <a
                  href={PROVIDER_MODEL_PRESETS[aiProvider]?.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-600 hover:underline inline-flex items-center gap-0.5"
                >
                  <span>Get {PROVIDER_MODEL_PRESETS[aiProvider]?.label} API key</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSaveAiKey}
            className="py-1 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>Save Configuration</span>
          </button>
          <button
            onClick={handleTestAiKey}
            disabled={isTestingAiKey || (!aiApiKey.trim() && aiProvider !== 'ollama')}
            className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded text-[11px] font-semibold transition-colors flex items-center gap-1"
          >
            {isTestingAiKey ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            <span>Test Connection</span>
          </button>
          {aiKeyStatus === 'saved' && (
            <button
              onClick={async () => {
                await removeAiSettings();
                setAiApiKey('');
                setAiModel('');
                setAiBaseUrl('');
                setAiKeyStatus('not_set');
                setAiMessage({ text: 'AI configuration removed. Using rule-based suggestions.', type: 'info' });
                setTimeout(() => setAiMessage(null), 3000);
              }}
              className="py-1 px-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded text-[11px] font-semibold transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        {/* AI Status / Alert Banner */}
        {aiMessage && (
          <div
            className={`p-2.5 rounded text-[11px] leading-relaxed flex items-start gap-1.5 ${
              aiMessage.type === 'success'
                ? 'bg-violet-50 text-violet-800 border border-violet-200'
                : aiMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{aiMessage.text}</span>
          </div>
        )}
      </div>

      {/* Master Profile & Document Selection Form */}
      <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-brand-600" />
            <h3 className="font-headline font-bold text-xs text-slate-900">
              Master Resume Configuration
            </h3>
          </div>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-medium">
            drive.file scope
          </span>
        </div>

        {/* Primary Document Selection via Google Picker */}
        <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 p-3 rounded border border-blue-200/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
              <span>Master Google Doc</span>
              <span className="text-[10px] text-brand-600 font-normal">(Primary Connection)</span>
            </label>
            {masterDocId && (
              <span className="text-[9px] font-mono text-slate-500 bg-white/80 px-1.5 py-0.2 rounded border border-slate-200">
                {masterDocId.slice(0, 16)}…
              </span>
            )}
          </div>

          <p className="text-[10px] text-slate-600 leading-tight">
            Under Google's secure <code className="font-mono bg-blue-100/70 px-1 py-0.2 rounded text-[9px] text-blue-800">drive.file</code> scope, you must select your resume via Google Drive Picker to authorize document reads, edits, and PDF exports.
          </p>

          <button
            type="button"
            onClick={async () => {
              setIsOpeningPicker(true);
              setPickerMessage(null);
              try {
                let token = await getGoogleAccessToken();
                if (!token) {
                  const authRes = await authenticateGoogleAccount(true);
                  if (authRes.success && authRes.accessToken) {
                    token = authRes.accessToken;
                    setAuthStatus('connected');
                  } else {
                    setPickerMessage({
                      text: 'Please connect your Google Account in the section above to launch Google Drive.',
                      type: 'error',
                    });
                    setIsOpeningPicker(false);
                    return;
                  }
                }

                await openGoogleDocPicker({
                  accessToken: token,
                  onPicked: async (doc) => {
                    setMasterDocId(doc.id);
                    setSelectedDocTitle(doc.name);
                    await saveStoredSettings({ masterDocId: doc.id });
                    setPickerMessage({
                      text: `✓ Selected and authorized "${doc.name}" from Google Drive!`,
                      type: 'success',
                    });
                    setIsOpeningPicker(false);
                  },
                  onCancel: () => {
                    setIsOpeningPicker(false);
                  },
                  onError: (err) => {
                    setPickerMessage({
                      text: `Google Picker: ${err.message}. You may use manual entry below if needed.`,
                      type: 'error',
                    });
                    setIsOpeningPicker(false);
                  },
                });
              } catch (err: any) {
                setPickerMessage({
                  text: `Picker error: ${err.message}`,
                  type: 'error',
                });
                setIsOpeningPicker(false);
              }
            }}
            disabled={isOpeningPicker}
            className="w-full py-2 px-3 rounded bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>{isOpeningPicker ? 'Opening Google Drive Picker…' : 'Select from Google Drive (Google Picker)'}</span>
          </button>

          {/* Selected Doc Status Banner */}
          {selectedDocTitle && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 p-2 rounded text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="font-semibold">Authorized Doc:</span> {selectedDocTitle}
              </div>
            </div>
          )}

          {pickerMessage && (
            <div className={`p-2 rounded text-[11px] leading-tight flex items-center gap-1.5 ${
              pickerMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {pickerMessage.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span>{pickerMessage.text}</span>
            </div>
          )}

          {/* Fallback Manual Doc ID Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowManualDocInput(!showManualDocInput)}
              className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
            >
              {showManualDocInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{showManualDocInput ? 'Hide manual Doc ID entry' : 'Advanced: Enter Google Doc ID manually'}</span>
            </button>

            {showManualDocInput && (
              <div className="mt-2 p-2 bg-amber-50/70 border border-amber-200/80 rounded space-y-1.5 text-slate-700">
                <label className="text-[10px] font-bold text-amber-900 block">
                  Manual Google Doc ID (Advanced Fallback)
                </label>
                <input
                  type="text"
                  value={masterDocId}
                  onChange={(e) => setMasterDocId(e.target.value)}
                  placeholder="Paste Google Doc ID (e.g. 1A2b3C4d...)"
                  className="w-full px-2 py-1 bg-white border border-amber-300 rounded font-mono text-[10px] text-slate-900 focus:outline-none focus:border-brand-500"
                />
                <p className="text-[9px] text-amber-800 leading-tight">
                  ⚠️ <strong>drive.file Notice:</strong> Manually entered doc IDs that were not selected via Google Picker may fail to authorize under the strict <code className="font-mono">drive.file</code> scope. Selection via Google Picker is recommended.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700">Candidate Full Name</label>
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700">Target Role Focus</label>
          <input
            type="text"
            value={targetTitle}
            onChange={(e) => setTargetTitle(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Anti-hallucination toggle */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <span className="text-xs font-semibold text-slate-800 block">Strict Factual Guardrails</span>
            <span className="text-[10px] text-slate-500 block">Never fabricate past experiences or metrics.</span>
          </div>
          <input
            type="checkbox"
            checked={strictAntiHallucination}
            onChange={(e) => setStrictAntiHallucination(e.target.checked)}
            className="w-4 h-4 accent-brand-600 rounded cursor-pointer"
          />
        </div>

        <button
          onClick={handleSavePreferences}
          className="w-full py-2 px-3 rounded-stitch bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {saved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
          <span>{saved ? 'Preferences Saved!' : 'Save Preferences'}</span>
        </button>
      </div>

      {/* Desktop Mascot Companion Card */}
      <div className="bg-white p-3.5 rounded-stitch border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
              🦉
            </div>
            <div>
              <h3 className="font-headline font-bold text-xs text-slate-900">
                Desktop Mascot Companion ("Hacky")
              </h3>
              <p className="text-[10px] text-slate-500">
                Always-on bottom-right screen assistant
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold">
            Active
          </span>
        </div>

        <p className="text-[11px] text-slate-600">
          Hacky floats on the bottom right of your browser, automatically detects active Google Docs and job openings, and opens ResumeHack with a single click.
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-[11px] text-slate-700 font-medium">
            Reset Screen Position
          </div>
          <button
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ resumehack_mascot_prefs: { position: null, isMinimized: false } });
              }
              try {
                localStorage.removeItem('resumehack_mascot_prefs');
              } catch {}
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[10px] transition-colors"
          >
            Snap to Bottom-Right
          </button>
        </div>
      </div>
    </div>
  );
};

