import { escapeHtml } from './canvas-editor.js';

export interface SelectionMetrics {
  text: string;
  words: number;
  chars: number;
  lines: number;
  rect: DOMRect | null;
  isCollapsed: boolean;
}

export interface HtmlSnapshot {
  html: string;
  text: string;
  timestamp: number;
}

/**
 * Manages an in-memory HTML snapshot stack for Google Docs-like non-destructive Undo/Redo.
 * Preserves DOM markup, styles, colors, links, and formatting attributes.
 */
export class DocumentSnapshotStack {
  private stack: HtmlSnapshot[] = [];
  private index: number = -1;
  private maxSnapshots: number = 60;

  constructor(initialHtml: string = '', initialText: string = '') {
    if (initialHtml || initialText) {
      this.push(initialHtml, initialText);
    }
  }

  public push(html: string, text: string): void {
    const trimmedHtml = html.trim();
    // Don't push duplicates
    if (this.index >= 0 && this.stack[this.index]?.html === trimmedHtml) {
      return;
    }
    // Discard any redos beyond current index
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push({
      html: trimmedHtml,
      text: text.trim(),
      timestamp: Date.now(),
    });

    if (this.stack.length > this.maxSnapshots) {
      this.stack.shift();
    }
    this.index = this.stack.length - 1;
  }

  public canUndo(): boolean {
    return this.index > 0;
  }

  public canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  public undo(): HtmlSnapshot | null {
    if (!this.canUndo()) return null;
    this.index--;
    return this.stack[this.index] || null;
  }

  public redo(): HtmlSnapshot | null {
    if (!this.canRedo()) return null;
    this.index++;
    return this.stack[this.index] || null;
  }

  public current(): HtmlSnapshot | null {
    return this.stack[this.index] || null;
  }

  public size(): number {
    return this.stack.length;
  }

  public currentIndex(): number {
    return this.index;
  }
}

/**
 * Saves current selection range safely.
 */
export function saveSelectionRange(): Range | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    return sel.getRangeAt(0).cloneRange();
  }
  return null;
}

/**
 * Restores a saved selection range.
 */
export function restoreSelectionRange(range: Range | null): void {
  if (typeof window === 'undefined' || !range) return;
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/**
 * Retrieves metrics and bounding rect of currently selected text in the canvas.
 */
export function getSelectionMetrics(editorRoot?: HTMLElement | null): SelectionMetrics {
  const fallback: SelectionMetrics = {
    text: '',
    words: 0,
    chars: 0,
    lines: 0,
    rect: null,
    isCollapsed: true,
  };

  if (typeof window === 'undefined') return fallback;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return fallback;

  const range = sel.getRangeAt(0);
  if (editorRoot && !editorRoot.contains(range.commonAncestorContainer)) {
    return fallback;
  }

  const text = range.toString();
  const isCollapsed = range.collapsed || !text.trim();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const lines = text.split('\n').filter(l => l.trim()).length || (text.length > 0 ? 1 : 0);

  let rect: DOMRect | null = null;
  try {
    const rects = range.getClientRects();
    if (rects.length > 0) {
      rect = rects[0];
    } else {
      rect = range.getBoundingClientRect();
    }
  } catch {}

  return {
    text,
    words,
    chars,
    lines,
    rect,
    isCollapsed,
  };
}

/**
 * Markdown trigger on typing (Space key):
 * Transforms '* ' or '- ' into bullet list, '1. ' into numbered list, '## ' into section header, '---' into divider.
 */
export function handleMarkdownShortcut(
  editorRoot: HTMLElement,
  event: React.KeyboardEvent | KeyboardEvent
): boolean {
  if (typeof window === 'undefined') return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

  const anchorNode = sel.anchorNode;
  if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) return false;

  const text = anchorNode.textContent || '';
  const caretOffset = sel.anchorOffset;
  const textBeforeCaret = text.slice(0, caretOffset);

  // 1. Bullet list trigger: '* ' or '- ' or '• ' at start of block
  if (/^(\*|-|•)$/.test(textBeforeCaret.trim())) {
    // Prevent default space character insertion
    event.preventDefault();

    // Check if already in a list item
    let parentBlock: HTMLElement | null = anchorNode.parentElement;
    while (parentBlock && parentBlock !== editorRoot && !/^(P|DIV|H[1-6]|LI)$/i.test(parentBlock.nodeName)) {
      parentBlock = parentBlock.parentElement;
    }

    if (parentBlock && parentBlock.nodeName.toUpperCase() === 'LI') {
      return false; // already a list item
    }

    // Strip trigger character
    anchorNode.textContent = text.slice(caretOffset);

    // Create list
    const ul = document.createElement('ul');
    ul.className = 'doc-bullets list-disc pl-5 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200';
    const li = document.createElement('li');
    li.textContent = anchorNode.textContent.trim() || '';
    if (!li.textContent) {
      li.appendChild(document.createElement('br'));
    }
    ul.appendChild(li);

    if (parentBlock && parentBlock !== editorRoot) {
      parentBlock.parentNode?.replaceChild(ul, parentBlock);
    } else {
      anchorNode.parentNode?.replaceChild(ul, anchorNode);
    }

    // Move caret inside new li
    const newRange = document.createRange();
    newRange.selectNodeContents(li);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  }

  // 2. Numbered list trigger: '1.' at start of block
  if (/^1\.$/.test(textBeforeCaret.trim())) {
    event.preventDefault();

    let parentBlock: HTMLElement | null = anchorNode.parentElement;
    while (parentBlock && parentBlock !== editorRoot && !/^(P|DIV|H[1-6]|LI)$/i.test(parentBlock.nodeName)) {
      parentBlock = parentBlock.parentElement;
    }
    if (parentBlock && parentBlock.nodeName.toUpperCase() === 'LI') return false;

    anchorNode.textContent = text.slice(caretOffset);

    const ol = document.createElement('ol');
    ol.className = 'doc-bullets list-decimal pl-5 space-y-1 my-1.5 text-xs text-zinc-800 dark:text-zinc-200';
    const li = document.createElement('li');
    li.textContent = anchorNode.textContent.trim() || '';
    if (!li.textContent) {
      li.appendChild(document.createElement('br'));
    }
    ol.appendChild(li);

    if (parentBlock && parentBlock !== editorRoot) {
      parentBlock.parentNode?.replaceChild(ol, parentBlock);
    } else {
      anchorNode.parentNode?.replaceChild(ol, anchorNode);
    }

    const newRange = document.createRange();
    newRange.selectNodeContents(li);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  }

  // 3. Section header trigger: '##' at start of block
  if (/^##$/.test(textBeforeCaret.trim())) {
    event.preventDefault();

    let parentBlock: HTMLElement | null = anchorNode.parentElement;
    while (parentBlock && parentBlock !== editorRoot && !/^(P|DIV|H[1-6]|LI)$/i.test(parentBlock.nodeName)) {
      parentBlock = parentBlock.parentElement;
    }

    anchorNode.textContent = text.slice(caretOffset);

    const h2 = document.createElement('h2');
    h2.className = 'doc-section-header font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1 mt-4 mb-2';
    h2.textContent = anchorNode.textContent.trim() || '';
    if (!h2.textContent) {
      h2.appendChild(document.createElement('br'));
    }

    if (parentBlock && parentBlock !== editorRoot) {
      parentBlock.parentNode?.replaceChild(h2, parentBlock);
    } else {
      anchorNode.parentNode?.replaceChild(h2, anchorNode);
    }

    const newRange = document.createRange();
    newRange.selectNodeContents(h2);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  }

  // 4. Horizontal Rule trigger: '---' or '***'
  if (/^(---|---)$/.test(textBeforeCaret.trim())) {
    event.preventDefault();
    anchorNode.textContent = '';
    const hr = document.createElement('hr');
    hr.className = 'my-3 border-t border-zinc-300 dark:border-zinc-700';
    const nextP = document.createElement('p');
    nextP.className = 'doc-text text-xs text-zinc-800 dark:text-zinc-200 my-1';
    nextP.appendChild(document.createElement('br'));

    let parentBlock: HTMLElement | null = anchorNode.parentElement;
    while (parentBlock && parentBlock !== editorRoot && !/^(P|DIV)$/i.test(parentBlock.nodeName)) {
      parentBlock = parentBlock.parentElement;
    }

    if (parentBlock && parentBlock !== editorRoot) {
      parentBlock.parentNode?.insertBefore(hr, parentBlock);
      parentBlock.parentNode?.insertBefore(nextP, parentBlock);
      parentBlock.remove();
    } else {
      editorRoot.appendChild(hr);
      editorRoot.appendChild(nextP);
    }

    const newRange = document.createRange();
    newRange.selectNodeContents(nextP);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  }

  return false;
}

/**
 * Smart Enter key handler:
 * - Empty bullet -> exits list and inserts clean paragraph `<p>` after list (Google Docs behavior)
 * - Shift+Enter -> soft line break `<br>` without exiting or creating bullet
 */
export function handleSmartEnter(
  editorRoot: HTMLElement,
  event: React.KeyboardEvent | KeyboardEvent
): boolean {
  if (typeof window === 'undefined') return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  // 1. Shift+Enter -> Soft Break `<br>` inside current element
  if (event.shiftKey) {
    event.preventDefault();
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement('br');
    range.insertNode(br);
    range.setStartAfter(br);
    range.setEndAfter(br);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }

  // 2. Check if inside an <li> element
  let node: Node | null = sel.anchorNode;
  let liElement: HTMLElement | null = null;
  while (node && node !== editorRoot) {
    if (node.nodeName.toUpperCase() === 'LI') {
      liElement = node as HTMLElement;
      break;
    }
    node = node.parentNode;
  }

  if (!liElement) return false;

  const parentList = liElement.parentElement;
  const content = liElement.textContent?.replace(/[\s\u200B\u00A0]+/g, ' ').trim() || '';

  // If the bullet is EMPTY, exit the list cleanly!
  if (!content) {
    event.preventDefault();
    const p = document.createElement('p');
    p.className = 'doc-text text-xs text-zinc-800 dark:text-zinc-200 my-1';
    p.appendChild(document.createElement('br'));

    if (parentList) {
      // Insert paragraph after the list
      if (parentList.nextSibling) {
        parentList.parentNode?.insertBefore(p, parentList.nextSibling);
      } else {
        parentList.parentNode?.appendChild(p);
      }

      // Remove the empty li
      liElement.remove();

      // If the list has no more li items, remove the list
      if (parentList.querySelectorAll('li').length === 0) {
        parentList.remove();
      }
    } else {
      liElement.parentNode?.replaceChild(p, liElement);
    }

    // Move caret inside the new paragraph
    const newRange = document.createRange();
    newRange.selectNodeContents(p);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  }

  return false;
}

/**
 * Smart Backspace key handler:
 * If caret is at the start of an empty bullet, removes it cleanly and focuses previous item or unbullets.
 */
export function handleSmartBackspace(
  editorRoot: HTMLElement,
  event: React.KeyboardEvent | KeyboardEvent
): boolean {
  if (typeof window === 'undefined') return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

  let node: Node | null = sel.anchorNode;
  let liElement: HTMLElement | null = null;
  while (node && node !== editorRoot) {
    if (node.nodeName.toUpperCase() === 'LI') {
      liElement = node as HTMLElement;
      break;
    }
    node = node.parentNode;
  }

  if (!liElement) return false;

  const isAtStart = sel.anchorOffset === 0;
  const content = liElement.textContent?.replace(/[\s\u200B\u00A0]+/g, ' ').trim() || '';

  // If empty bullet and at offset 0: remove bullet and exit
  if (!content && isAtStart) {
    event.preventDefault();
    const parentList = liElement.parentElement;
    const prevSibling = liElement.previousElementSibling;

    liElement.remove();

    if (prevSibling) {
      const newRange = document.createRange();
      newRange.selectNodeContents(prevSibling);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else if (parentList) {
      const p = document.createElement('p');
      p.className = 'doc-text text-xs text-zinc-800 dark:text-zinc-200 my-1';
      p.appendChild(document.createElement('br'));
      parentList.parentNode?.insertBefore(p, parentList);
      if (parentList.querySelectorAll('li').length === 0) {
        parentList.remove();
      }
      const newRange = document.createRange();
      newRange.selectNodeContents(p);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    return true;
  }

  return false;
}

/**
 * Moves current bullet point or section item up or down via Alt+ArrowUp / Alt+ArrowDown.
 */
export function handleMoveItem(
  editorRoot: HTMLElement,
  direction: 'up' | 'down'
): boolean {
  if (typeof window === 'undefined') return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  let target: HTMLElement | null = null;
  let node: Node | null = sel.anchorNode;
  while (node && node !== editorRoot) {
    if (/^(LI|TR|DIV)$/i.test(node.nodeName)) {
      target = node as HTMLElement;
      if (node.nodeName.toUpperCase() === 'LI') break;
      if (target.classList.contains('doc-entry-header') || target.classList.contains('doc-section')) break;
    }
    node = node.parentNode;
  }

  if (!target || !target.parentElement) return false;

  if (direction === 'up') {
    const prev = target.previousElementSibling;
    if (!prev) return false;
    target.parentElement.insertBefore(target, prev);
  } else {
    const next = target.nextElementSibling;
    if (!next) return false;
    target.parentElement.insertBefore(next, target);
  }

  // Restore caret inside target
  const newRange = document.createRange();
  newRange.selectNodeContents(target);
  newRange.collapse(false);
  sel.removeAllRanges();
  sel.addRange(newRange);
  return true;
}

/**
 * Smart Multi-Line Paste:
 * Detects if pasted text has bullet markers and formats them cleanly into `<li>` items.
 */
export function parseSmartPastedText(pastedText: string): { isBulletList: boolean; items: string[] } {
  if (!pastedText) return { isBulletList: false, items: [] };
  const lines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { isBulletList: false, items: [] };

  const bulletRegex = /^[\uF0B7\u25CF\u25CB\u25A0\u25AA\u2022\u2023\u2043\u2013\u2014•▪▸▹‣◦○*\-●■◆✦➢✓–—]\s*|^[0-9]+[.)]\s*/;
  const bulletLines = lines.filter(l => bulletRegex.test(l));

  if (bulletLines.length >= 2 || (lines.length === 1 && bulletRegex.test(lines[0]))) {
    const cleanItems = lines.map(l => l.replace(bulletRegex, '').trim()).filter(Boolean);
    return {
      isBulletList: true,
      items: cleanItems,
    };
  }

  return {
    isBulletList: false,
    items: lines,
  };
}
