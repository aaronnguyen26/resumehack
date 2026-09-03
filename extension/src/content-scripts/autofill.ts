// ResumeHack ATS Application Autofill, PDF Attachment & Verified Submission Engine
// Multi-portal support: Greenhouse, Lever, Ashby, SmartRecruiters (Workday as Manual Assist)

import {
  AutoSubmitEngine,
  FormInputDescriptor,
  AutoSubmitReport,
  DECLINE_OPTION_PATTERN,
  EEO_DEMOGRAPHIC_PATTERNS
} from '../services/auto-submit-engine.js';
import { ApplicantProfile } from '../types/index.js';
import { DEFAULT_APPLICANT_PROFILE } from '../services/storage.js';

const engine = new AutoSubmitEngine();

/**
 * Dispatches standard synthetic and native events to ensure React and ATS form state registers the input.
 */
function setReactInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  try {
    const proto = element instanceof HTMLTextAreaElement 
      ? window.HTMLTextAreaElement.prototype 
      : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      desc.set.call(element, value);
    } else {
      element.value = value;
    }
  } catch {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * Scans the active page for form inputs, textareas, dropdowns, and file upload fields.
 */
function scanPageForm(): { portal: string; inputs: FormInputDescriptor[]; report: AutoSubmitReport } {
  const portal = engine.detectPortal(window.location.href, document.body.innerHTML);
  const elements = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
  const descriptors: FormInputDescriptor[] = [];

  elements.forEach((el) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const name = input.name || '';
    const id = input.id || '';
    const placeholder = (input as HTMLInputElement).placeholder || '';
    const ariaLabel = input.getAttribute('aria-label') || '';
    const label = input.closest('label')?.textContent?.trim() ||
      (id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() : '') ||
      input.getAttribute('aria-labelledby') ? document.getElementById(input.getAttribute('aria-labelledby') || '')?.textContent?.trim() : '';

    const required = input.hasAttribute('required') ||
      input.getAttribute('aria-required') === 'true' ||
      (label && label.includes('*'));

    let options: Array<{ text: string; value: string }> | undefined;
    if (input instanceof HTMLSelectElement) {
      options = Array.from(input.options).map((opt) => ({
        text: opt.textContent?.trim() || opt.text?.trim() || '',
        value: opt.value || '',
      }));
    }

    descriptors.push({
      id,
      name,
      placeholder,
      label: label || '',
      ariaLabel,
      type: input.type || (input instanceof HTMLTextAreaElement ? 'textarea' : 'text'),
      tagName: input.tagName.toLowerCase(),
      required: !!required,
      options,
    });
  });

  const report = engine.planAutoFill(portal, descriptors);
  return { portal, inputs: descriptors, report };
}

/**
 * Injects a resume PDF into an input[type="file"] field using native DataTransfer and File API.
 */
function attachResumePdf(
  fileInput: HTMLInputElement,
  pdfBase64: string,
  fileName: string = 'Resume.pdf'
): { attached: boolean; verified: boolean; verificationMessage?: string } {
  try {
    const binaryStr = atob(pdfBase64.replace(/^data:application\/pdf;base64,/, ''));
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const file = new File([blob], fileName, { type: 'application/pdf', lastModified: Date.now() });

    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;

    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Also trigger drop/dragover on parent dropzone if present
    const dropzone = fileInput.closest('.dropzone, [data-dropzone], .file-upload, .upload-container');
    if (dropzone) {
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      });
      dropzone.dispatchEvent(dropEvent);
    }

    // Post-attachment verification
    const containerText = (fileInput.closest('form, div') || document.body).textContent || '';
    const hasVisualConfirmation =
      containerText.includes(fileName) ||
      document.querySelector('.filename, #resume_filename, .file-name, [data-testid="file-preview"]') !== null;

    return {
      attached: true,
      verified: hasVisualConfirmation,
      verificationMessage: hasVisualConfirmation
        ? `Verified attachment of "${fileName}"`
        : `Attached "${fileName}", pending portal preview update`,
    };
  } catch (err: any) {
    console.error('[ResumeHack Autofill] PDF attachment error:', err);
    return { attached: false, verified: false, verificationMessage: err.message };
  }
}

/**
 * Executes autofill across the page using approved profile data and custom answers.
 */
function applyAutofill(
  profile: ApplicantProfile,
  customAnswers: Record<string, string> = {},
  pdfBase64?: string,
  pdfFileName?: string
): { filledCount: number; eeoSkippedCount: number; declineSelectedCount: number; fileAttached: boolean; fileVerified: boolean } {
  const elements = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
  let filledCount = 0;
  let eeoSkippedCount = 0;
  let declineSelectedCount = 0;
  let fileAttached = false;
  let fileVerified = false;

  elements.forEach((el) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const name = input.name || '';
    const id = input.id || '';
    const placeholder = (input as HTMLInputElement).placeholder || '';
    const ariaLabel = input.getAttribute('aria-label') || '';
    const label = input.closest('label')?.textContent?.trim() ||
      (id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() : '') ||
      '';
    const required = input.hasAttribute('required') || input.getAttribute('aria-required') === 'true' || (label && label.includes('*'));

    const combined = `${name} ${id} ${placeholder} ${ariaLabel} ${label}`.trim();
    const type = (input.type || (input instanceof HTMLTextAreaElement ? 'textarea' : 'text')).toLowerCase();

    // 1. File Upload (Resume PDF)
    if (type === 'file' && pdfBase64 && !fileAttached) {
      const attachRes = attachResumePdf(input as HTMLInputElement, pdfBase64, pdfFileName || `${profile.firstName}_${profile.lastName}_Resume.pdf`);
      fileAttached = attachRes.attached;
      fileVerified = attachRes.verified;
      if (fileAttached) filledCount++;
      return;
    }

    // 2. EEO / Demographic Handling
    if (engine.isEeoField(combined)) {
      if (required && input instanceof HTMLSelectElement) {
        // Find explicit decline option
        for (let i = 0; i < input.options.length; i++) {
          const opt = input.options[i];
          if (DECLINE_OPTION_PATTERN.test(opt.text.trim()) || DECLINE_OPTION_PATTERN.test(opt.value.trim())) {
            input.selectedIndex = i;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            declineSelectedCount++;
            return;
          }
        }
      }
      // Non-required or no decline option -> Leave 100% untouched
      eeoSkippedCount++;
      return;
    }

    // 3. Custom Questions
    if (input instanceof HTMLTextAreaElement || (type === 'text' && combined.length > 50)) {
      const answer = customAnswers[id] || customAnswers[name] || customAnswers[combined] || Object.values(customAnswers)[0];
      if (answer && (!input.value || input.value.trim() === '')) {
        setReactInputValue(input as any, answer);
        filledCount++;
        return;
      }
    }

    // 4. Standard Profile Fields
    const match = engine.matchFieldKey(combined, type);
    if (match && match.fieldKey) {
      const val = engine.resolveFieldValue(profile, match.fieldKey);
      if (val) {
        if (input instanceof HTMLSelectElement) {
          // Select closest matching option
          for (let i = 0; i < input.options.length; i++) {
            const opt = input.options[i];
            if (opt.text.toLowerCase().includes(val.toLowerCase()) || opt.value.toLowerCase().includes(val.toLowerCase())) {
              input.selectedIndex = i;
              input.dispatchEvent(new Event('change', { bubbles: true }));
              filledCount++;
              return;
            }
          }
        } else if (input instanceof HTMLInputElement && (type === 'radio' || type === 'checkbox')) {
          if (match.fieldKey === 'requiresVisaSponsorship') {
            const isYes = val === 'Yes';
            const radioLabel = label.toLowerCase();
            if ((isYes && radioLabel.includes('yes')) || (!isYes && radioLabel.includes('no'))) {
              input.checked = true;
              input.dispatchEvent(new Event('change', { bubbles: true }));
              filledCount++;
            }
          }
        } else {
          setReactInputValue(input as any, val);
          filledCount++;
        }
      }
    }
  });

  showAutofillToast(filledCount, eeoSkippedCount);
  return { filledCount, eeoSkippedCount, declineSelectedCount, fileAttached, fileVerified };
}

/**
 * Submits the ATS application and verifies positive confirmation signals.
 */
async function submitAndVerify(portal: string): Promise<{ success: boolean; signal?: string; error?: string }> {
  // 1. Locate Submit Button
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    '#submit_app',
    '#create_application',
    'button:contains("Submit Application")',
    'button:contains("Submit application")',
    'button:contains("Submit")',
    '[data-qa="btn-submit"]',
    '.postings-btn-wrapper button',
  ];

  let submitBtn: HTMLElement | null = null;
  for (const sel of submitSelectors) {
    try {
      const found = document.querySelector(sel);
      if (found && (found as HTMLElement).offsetParent !== null) {
        submitBtn = found as HTMLElement;
        break;
      }
    } catch {}
  }

  // Text search fallback for buttons
  if (!submitBtn) {
    const allButtons = Array.from(document.querySelectorAll('button, a.button, input[type="button"]'));
    submitBtn = (allButtons.find((btn) => {
      const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase().trim();
      return (txt.includes('submit') || txt.includes('apply')) && !txt.includes('cancel') && !txt.includes('back');
    }) as HTMLElement) || null;
  }

  if (!submitBtn) {
    return { success: false, error: 'Could not locate the final Submit Application button on this page.' };
  }

  // 2. Click the button
  submitBtn.click();

  // 3. Monitor for Positive Confirmation Signals (poll up to 7 seconds)
  const startTime = Date.now();
  while (Date.now() - startTime < 7000) {
    await new Promise((r) => setTimeout(r, 500));

    const url = window.location.href.toLowerCase();
    const bodyText = document.body.textContent?.toLowerCase() || '';

    // Error detection
    const hasVisibleError = document.querySelector('.field-error, [aria-invalid="true"], .error-message, .alert-danger');
    if (hasVisibleError) {
      const errText = hasVisibleError.textContent?.trim() || 'Form validation error detected on page';
      return { success: false, error: errText };
    }

    // Greenhouse Confirmation
    if (portal === 'greenhouse' && (url.includes('/confirmation') || url.includes('/thanks') || bodyText.includes('thank you for applying to') || document.querySelector('.confirmation-message, #application_confirmation'))) {
      return { success: true, signal: 'Greenhouse Confirmation Page Detected' };
    }

    // Lever Confirmation
    if (portal === 'lever' && (url.includes('/thanks') || bodyText.includes('your application has been submitted') || document.querySelector('.application-submitted, .thanks-message'))) {
      return { success: true, signal: 'Lever Submission Confirmation Detected' };
    }

    // Ashby Confirmation
    if (portal === 'ashby' && (url.includes('/submitted') || bodyText.includes('application received') || document.querySelector('[data-testid="application-success"]'))) {
      return { success: true, signal: 'Ashby Submission Confirmation Detected' };
    }

    // SmartRecruiters Confirmation
    if (portal === 'smartrecruiters' && (url.includes('/success') || bodyText.includes('application sent') || document.querySelector('.success-header, .confirmation'))) {
      return { success: true, signal: 'SmartRecruiters Confirmation Detected' };
    }

    // Generic Positive Confirmation
    if (bodyText.includes('thank you for applying') || bodyText.includes('application successfully submitted') || bodyText.includes('application has been received')) {
      return { success: true, signal: 'Application Confirmation Message Verified' };
    }
  }

  return { success: false, error: 'Submission initiated, but positive confirmation was not received within 7 seconds. Please verify on the tab.' };
}

function showAutofillToast(filled: number, eeoSkipped: number): void {
  const existing = document.getElementById('rh-autofill-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'rh-autofill-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: #0F172A;
    color: #FFFFFF;
    padding: 10px 20px;
    border-radius: 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: rh-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  toast.innerHTML = `<span>⚡ ResumeHack:</span> <span>Assembled <strong>${filled}</strong> fields</span> ${eeoSkipped > 0 ? `<span style="color:#94A3B8; font-weight:normal;">(${eeoSkipped} EEO skipped)</span>` : ''}`;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

// ────────────────────────────────────────────────────────────────────────────
// Message Handlers
// ────────────────────────────────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SCAN_FORM') {
        const result = scanPageForm();
        sendResponse({ success: true, data: result });
        return true;
      }

      if (message.type === 'EXECUTE_AUTOFILL') {
        const { profile, customAnswers, pdfBase64, pdfFileName } = message.payload || {};
        const res = applyAutofill(profile || DEFAULT_APPLICANT_PROFILE, customAnswers || {}, pdfBase64, pdfFileName);
        sendResponse({ success: true, data: res });
        return true;
      }

      if (message.type === 'EXECUTE_SUBMIT') {
        const { portal } = message.payload || { portal: 'generic_form' };
        submitAndVerify(portal).then((submitRes) => {
          sendResponse(submitRes);
        });
        return true; // Keep message channel open for async response
      }

      // Legacy fallback
      if (message.type === 'TRIGGER_AUTOFILL') {
        const res = applyAutofill(DEFAULT_APPLICANT_PROFILE);
        sendResponse({ success: true, filledCount: res.filledCount });
        return true;
      }

      return false;
    });
  } catch {
    /* context invalidated */
  }
}
