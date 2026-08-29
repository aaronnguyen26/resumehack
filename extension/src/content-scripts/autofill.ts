// ATS Application Autofill Engine

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
  degree: 'Bachelor of Science in Computer Science',
  gpa: '3.85',
  gradDate: 'May 2026'
};

function autofillFields() {
  const inputs = document.querySelectorAll('input, textarea, select');
  let filledCount = 0;

  inputs.forEach((el) => {
    const input = el as HTMLInputElement;
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const label = input.closest('label')?.textContent?.toLowerCase() || '';
    const fieldIdentifier = `${name} ${id} ${placeholder} ${label}`;

    if (input.value && input.value.trim() !== '') return;

    if (fieldIdentifier.includes('first name') || fieldIdentifier.includes('given name')) {
      input.value = DEFAULT_PROFILE.firstName;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('last name') || fieldIdentifier.includes('family name') || fieldIdentifier.includes('surname')) {
      input.value = DEFAULT_PROFILE.lastName;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('full name') || (name === 'name' && !fieldIdentifier.includes('company'))) {
      input.value = DEFAULT_PROFILE.fullName;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('email')) {
      input.value = DEFAULT_PROFILE.email;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('phone') || fieldIdentifier.includes('mobile')) {
      input.value = DEFAULT_PROFILE.phone;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('linkedin')) {
      input.value = DEFAULT_PROFILE.linkedin;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('github')) {
      input.value = DEFAULT_PROFILE.github;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('website') || fieldIdentifier.includes('portfolio')) {
      input.value = DEFAULT_PROFILE.portfolio;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('city') || fieldIdentifier.includes('location') || fieldIdentifier.includes('address')) {
      input.value = DEFAULT_PROFILE.location;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('school') || fieldIdentifier.includes('university') || fieldIdentifier.includes('college')) {
      input.value = DEFAULT_PROFILE.school;
      triggerEvents(input);
      filledCount++;
    } else if (fieldIdentifier.includes('gpa')) {
      input.value = DEFAULT_PROFILE.gpa;
      triggerEvents(input);
      filledCount++;
    }
  });

  return filledCount;
}

function triggerEvents(element: HTMLInputElement) {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Listen for autofill trigger from sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRIGGER_AUTOFILL') {
    const filled = autofillFields();
    sendResponse({ success: true, filledCount: filled });
  }
});
