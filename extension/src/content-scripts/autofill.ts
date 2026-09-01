// ATS Application Autofill & Smart Auto-Submit Engine
// Multi-portal support: Greenhouse, Lever, Workday, Ashby, SmartRecruiters, Handshake, Custom Forms

const DEFAULT_PROFILE = {
  firstName: 'Alex',
  lastName: 'Chen',
  fullName: 'Alex Chen',
  email: 'alex.chen@example.com',
  phone: '415-555-0199',
  linkedin: 'https://linkedin.com/in/alexchen',
  github: 'https://github.com/alexchen',
  portfolio: 'https://alexchen.dev',
  location: 'San Francisco, CA',
  school: 'University of California, Berkeley',
  degree: 'Bachelor of Science',
  major: 'Computer Science',
  gpa: '3.85',
  gradDate: 'May 2026',
  workAuth: 'US Citizen / Permanent Resident'
};

function triggerReactInput(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
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

function autofillFields(): number {
  const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
  let filledCount = 0;

  inputs.forEach((el) => {
    const input = el as HTMLInputElement;
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const label = input.closest('label')?.textContent?.toLowerCase() || '';
    const fieldIdentifier = `${name} ${id} ${placeholder} ${ariaLabel} ${label}`.trim();

    if (input.value && input.value.trim() !== '') return;

    if (fieldIdentifier.includes('first name') || fieldIdentifier.includes('given name') || name === 'fname') {
      triggerReactInput(input, DEFAULT_PROFILE.firstName);
      filledCount++;
    } else if (fieldIdentifier.includes('last name') || fieldIdentifier.includes('family name') || fieldIdentifier.includes('surname') || name === 'lname') {
      triggerReactInput(input, DEFAULT_PROFILE.lastName);
      filledCount++;
    } else if (fieldIdentifier.includes('full name') || (name === 'name' && !fieldIdentifier.includes('company'))) {
      triggerReactInput(input, DEFAULT_PROFILE.fullName);
      filledCount++;
    } else if (fieldIdentifier.includes('email')) {
      triggerReactInput(input, DEFAULT_PROFILE.email);
      filledCount++;
    } else if (fieldIdentifier.includes('phone') || fieldIdentifier.includes('mobile') || fieldIdentifier.includes('tel')) {
      triggerReactInput(input, DEFAULT_PROFILE.phone);
      filledCount++;
    } else if (fieldIdentifier.includes('linkedin')) {
      triggerReactInput(input, DEFAULT_PROFILE.linkedin);
      filledCount++;
    } else if (fieldIdentifier.includes('github')) {
      triggerReactInput(input, DEFAULT_PROFILE.github);
      filledCount++;
    } else if (fieldIdentifier.includes('website') || fieldIdentifier.includes('portfolio')) {
      triggerReactInput(input, DEFAULT_PROFILE.portfolio);
      filledCount++;
    } else if (fieldIdentifier.includes('city') || fieldIdentifier.includes('location') || fieldIdentifier.includes('address')) {
      triggerReactInput(input, DEFAULT_PROFILE.location);
      filledCount++;
    } else if (fieldIdentifier.includes('school') || fieldIdentifier.includes('university') || fieldIdentifier.includes('college') || fieldIdentifier.includes('institution')) {
      triggerReactInput(input, DEFAULT_PROFILE.school);
      filledCount++;
    } else if (fieldIdentifier.includes('degree') || fieldIdentifier.includes('education level')) {
      triggerReactInput(input, DEFAULT_PROFILE.degree);
      filledCount++;
    } else if (fieldIdentifier.includes('major') || fieldIdentifier.includes('field of study') || fieldIdentifier.includes('discipline')) {
      triggerReactInput(input, DEFAULT_PROFILE.major);
      filledCount++;
    } else if (fieldIdentifier.includes('gpa') || fieldIdentifier.includes('grade point')) {
      triggerReactInput(input, DEFAULT_PROFILE.gpa);
      filledCount++;
    } else if (fieldIdentifier.includes('grad') || fieldIdentifier.includes('graduation')) {
      triggerReactInput(input, DEFAULT_PROFILE.gradDate);
      filledCount++;
    }
  });

  showAutofillToast(filledCount);
  return filledCount;
}

function showAutofillToast(count: number): void {
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
  toast.innerHTML = `<span>⚡ ResumeHack:</span> <span>Autofilled <strong>${count}</strong> application fields!</span>`;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

// Listen for autofill trigger from sidepanel or mascot
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'TRIGGER_AUTOFILL') {
        const filled = autofillFields();
        sendResponse({ success: true, filledCount: filled });
        return true;
      }
      return false;
    });
  } catch { /* context invalidated */ }
}
