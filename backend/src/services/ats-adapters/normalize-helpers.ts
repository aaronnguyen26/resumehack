import { JobType, WorkModel } from '../../types/ats.js';

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

export function stripHtml(html: string): string {
  if (!html) return '';
  // Decode up to twice in case of double-escaped entities from raw ATS feeds
  let decoded = decodeHtmlEntities(html);
  if (decoded.includes('&lt;') || decoded.includes('&gt;') || decoded.includes('&amp;')) {
    decoded = decodeHtmlEntities(decoded);
  }
  return decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function inferJobType(title: string, rawText?: string): JobType {
  const combined = `${title} ${rawText || ''}`.toLowerCase();
  if (/\b(intern|internship|co-op|coop|summer analyst|fellow|fellowship)\b/i.test(title)) {
    return 'Internship';
  }
  if (/\b(new grad|entry level|associate engineer|junior|campus)\b/i.test(title)) {
    return 'New Grad';
  }
  if (/\b(senior|staff|lead|principal|director|head of|manager|vp)\b/i.test(title)) {
    return 'Full-time';
  }
  if (/\b(full[- ]time|contract|permanent)\b/i.test(combined)) {
    return 'Full-time';
  }
  return 'unknown';
}

export function inferWorkModel(locationStr: string, rawText?: string): WorkModel {
  const combined = `${locationStr} ${rawText || ''}`.toLowerCase();
  if (/\bremote\b/i.test(combined) || combined.includes('anywhere') || combined.includes('virtual')) {
    return 'Remote';
  }
  if (/\bhybrid\b/i.test(combined)) {
    return 'Hybrid';
  }
  if (/\bon[- ]site\b/i.test(combined) || /\bonsite\b/i.test(combined)) {
    return 'On-site';
  }
  return 'Hybrid';
}

export function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('quant') || t.includes('algorithmic trading')) return 'Finance & Quant';
  if (t.includes('investment banking') || t.includes('accounting') || t.includes('audit') || t.includes('fp&a') || (t.includes('finance') && !t.includes('quant'))) return 'Finance & Accounting';
  if (t.includes('marketing') || t.includes('brand') || t.includes('communications') || t.includes('growth')) return 'Marketing & Communications';
  if (t.includes('product design') || t.includes('ui/ux') || t.includes('interaction design') || t.includes('graphic design')) return 'Design & Creative';
  if (t.includes('product manager') || t.includes(' pm ') || t.includes('apm') || t.includes('program manager')) return 'Product Management';
  if (t.includes('data') || t.includes('machine learning') || t.includes(' ml') || t.includes('ai ') || t.includes('deep learning') || t.includes('computer vision')) return 'Data & AI';
  if (t.includes('hardware') || t.includes('embedded') || t.includes('firmware') || t.includes('fpga') || t.includes('electrical')) return 'Hardware & Embedded';
  if (t.includes('security') || t.includes('cyber') || t.includes('infosec')) return 'Cybersecurity';
  if (t.includes('business analyst') || t.includes('strategy') || t.includes('consulting')) return 'Business & Strategy';
  if (t.includes('legal') || t.includes('paralegal') || t.includes('compliance')) return 'Legal & Compliance';
  if (t.includes('operations') || t.includes('supply chain') || t.includes('recruiting') || t.includes('hr ')) return 'Operations & HR';
  return 'Software Engineering';
}

export function extractSkills(description: string): string[] {
  const keywords = [
    'Python', 'TypeScript', 'JavaScript', 'Java', 'C++', 'Go', 'Golang', 'Rust', 'SQL',
    'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'FastAPI',
    'PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'AWS', 'GCP', 'Azure', 'Docker',
    'Kubernetes', 'CI/CD', 'GraphQL', 'REST API', 'Microservices', 'PyTorch', 'TensorFlow',
    'Machine Learning', 'LLMs', 'System Design', 'Git'
  ];
  const found: string[] = [];
  for (const kw of keywords) {
    if (new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i').test(description)) {
      found.push(kw);
    }
  }
  return found.slice(0, 10);
}
