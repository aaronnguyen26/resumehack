import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  DocumentSnapshotStack,
  parseSmartPastedText,
} from '../services/google-docs-editor-engine.js';

describe('Google Docs Convenience & Canvas Editing Engine', () => {
  const canvasPath = path.resolve(__dirname, '../../../web/src/components/InAppDocumentCanvas.tsx');
  const enginePath = path.resolve(__dirname, '../../../web/src/services/google-docs-editor-engine.ts');

  let canvasCode = '';
  let engineCode = '';
  try {
    canvasCode = fs.readFileSync(canvasPath, 'utf-8');
    engineCode = fs.readFileSync(enginePath, 'utf-8');
  } catch {}

  describe('Part 1: DocumentSnapshotStack (Non-Destructive Undo/Redo)', () => {
    it('initializes with initial HTML and text snapshot', () => {
      const initialHtml = '<p class="doc-text">Initial resume content</p>';
      const initialText = 'Initial resume content';
      const stack = new DocumentSnapshotStack(initialHtml, initialText);

      expect(stack.size()).toBe(1);
      expect(stack.canUndo()).toBe(false);
      expect(stack.canRedo()).toBe(false);
      expect(stack.current()?.html).toBe(initialHtml);
      expect(stack.current()?.text).toBe(initialText);
    });

    it('pushes snapshots and supports non-destructive undo and redo', () => {
      const stack = new DocumentSnapshotStack();
      stack.push('<h1>Alex Chen</h1>', 'Alex Chen');
      stack.push('<h1>Alex Chen</h1><p>Software Engineer</p>', 'Alex Chen\nSoftware Engineer');
      stack.push('<h1>Alex Chen</h1><p>Software Engineer</p><ul><li>Engineered Redis</li></ul>', 'Alex Chen\nSoftware Engineer\n• Engineered Redis');

      expect(stack.size()).toBe(3);
      expect(stack.canUndo()).toBe(true);
      expect(stack.canRedo()).toBe(false);

      // Undo step 1
      const step2 = stack.undo();
      expect(step2?.html).toBe('<h1>Alex Chen</h1><p>Software Engineer</p>');
      expect(step2?.text).toBe('Alex Chen\nSoftware Engineer');
      expect(stack.canRedo()).toBe(true);

      // Undo step 2
      const step1 = stack.undo();
      expect(step1?.html).toBe('<h1>Alex Chen</h1>');
      expect(step1?.text).toBe('Alex Chen');
      expect(stack.canUndo()).toBe(false);

      // Redo step 1
      const redoStep2 = stack.redo();
      expect(redoStep2?.html).toBe('<h1>Alex Chen</h1><p>Software Engineer</p>');

      // Redo step 2
      const redoStep3 = stack.redo();
      expect(redoStep3?.html).toBe('<h1>Alex Chen</h1><p>Software Engineer</p><ul><li>Engineered Redis</li></ul>');
      expect(stack.canRedo()).toBe(false);
    });

    it('deduplicates consecutive identical snapshots and discards redo branch on new push', () => {
      const stack = new DocumentSnapshotStack();
      stack.push('<p>Version 1</p>', 'Version 1');
      stack.push('<p>Version 1</p>', 'Version 1'); // Duplicate push
      expect(stack.size()).toBe(1);

      stack.push('<p>Version 2</p>', 'Version 2');
      stack.push('<p>Version 3</p>', 'Version 3');
      stack.undo(); // back to Version 2

      // Pushing new branch discards Version 3
      stack.push('<p>Version 2.1 Branch</p>', 'Version 2.1 Branch');
      expect(stack.canRedo()).toBe(false);
      expect(stack.current()?.html).toBe('<p>Version 2.1 Branch</p>');
    });
  });

  describe('Part 2: Smart Multi-Line Paste Engine', () => {
    it('detects and parses multi-line bullet points with standard bullets', () => {
      const pasted = `• Architected distributed Redis caching layer
• Engineered idempotent ledger replication pipeline
• Spearheaded migration from REST to gRPC`;

      const result = parseSmartPastedText(pasted);
      expect(result.isBulletList).toBe(true);
      expect(result.items.length).toBe(3);
      expect(result.items[0]).toBe('Architected distributed Redis caching layer');
      expect(result.items[1]).toBe('Engineered idempotent ledger replication pipeline');
      expect(result.items[2]).toBe('Spearheaded migration from REST to gRPC');
    });

    it('detects and parses dash and numbered bullet formats', () => {
      const pastedDashes = `- Built React frontend dashboard\n- Integrated Stripe checkout payments\n- Authored unit test suites`;
      const resDashes = parseSmartPastedText(pastedDashes);
      expect(resDashes.isBulletList).toBe(true);
      expect(resDashes.items.length).toBe(3);
      expect(resDashes.items[0]).toBe('Built React frontend dashboard');

      const pastedNums = `1. First achievement\n2. Second achievement\n3. Third achievement`;
      const resNums = parseSmartPastedText(pastedNums);
      expect(resNums.isBulletList).toBe(true);
      expect(resNums.items.length).toBe(3);
      expect(resNums.items[1]).toBe('Second achievement');
    });

    it('preserves regular paragraph text as non-bullet lines', () => {
      const pastedSummary = `Staff Distributed Systems Engineer with 7+ years architecting high-throughput financial backends processing billions of requests.`;
      const result = parseSmartPastedText(pastedSummary);
      expect(result.isBulletList).toBe(false);
      expect(result.items.length).toBe(1);
    });
  });

  describe('Part 3: InAppDocumentCanvas Source Code & Google Docs Ergonomics Audit', () => {
    it('integrates DocumentSnapshotStack and non-destructive undo/redo', () => {
      expect(canvasCode).toContain('DocumentSnapshotStack');
      expect(canvasCode).toContain('snapshotStackRef');

      const undoStartIndex = canvasCode.indexOf('const handleUndo = useCallback(');
      const redoStartIndex = canvasCode.indexOf('const handleRedo = useCallback(');
      const shortcutsIndex = canvasCode.indexOf('const handleEditorKeyDown =');

      expect(undoStartIndex).toBeGreaterThan(-1);
      expect(redoStartIndex).toBeGreaterThan(-1);

      const handleUndoFn = canvasCode.slice(undoStartIndex, redoStartIndex);
      expect(handleUndoFn).not.toContain('rawTextToHtml');

      const handleRedoFn = canvasCode.slice(redoStartIndex, shortcutsIndex);
      expect(handleRedoFn).not.toContain('rawTextToHtml');
    });

    it('implements floating contextual selection bubble toolbar with AI Elevate and telemetry', () => {
      expect(canvasCode).toContain('floatingToolbarPos');
      expect(canvasCode).toContain('GOOGLE DOCS FLOATING SELECTION BUBBLE TOOLBAR');
      expect(canvasCode).toContain('handleElevateSelectedText');
      expect(canvasCode).toContain('selectionMetrics.words');
      expect(canvasCode).toContain('selectionMetrics.chars');
      expect(canvasCode).toContain('Elevate');
    });

    it('implements Quick Section Outline Jump Navigator and Quick Add actions', () => {
      expect(canvasCode).toContain('handleScrollToSection');
      expect(canvasCode).toContain('handleQuickAddBullet');
      expect(canvasCode).toContain('Jump to:');
      expect(canvasCode).toContain('+ Bullet');
      expect(canvasCode).toContain('+ Position');
    });

    it('implements distraction-free Focus / Zen writing mode', () => {
      expect(canvasCode).toContain('isZenMode');
      expect(canvasCode).toContain('Focus Mode');
      expect(canvasCode).toContain('Exit Focus');
      expect(canvasCode).toContain('isInspectorOpen && !isZenMode');
    });

    it('supports comprehensive Google Docs keyboard shortcuts map', () => {
      // Space markdown shortcut
      expect(canvasCode).toContain('handleMarkdownShortcut');
      // Smart Enter list break & soft break
      expect(canvasCode).toContain('handleSmartEnter');
      // Smart Backspace unbullet
      expect(canvasCode).toContain('handleSmartBackspace');
      // Reorder items via Alt+ArrowUp / Alt+ArrowDown
      expect(canvasCode).toContain('handleMoveItem');
      // Tab and Shift+Tab indent/outdent
      expect(canvasCode).toContain("e.key === 'Tab'");
      // Hyperlink shortcut
      expect(canvasCode).toContain("key === 'k'");
      // List shortcuts
      expect(canvasCode).toContain("e.key === '7'");
      expect(canvasCode).toContain("e.key === '8'");
      // Heading shortcuts
      expect(canvasCode).toContain("e.altKey && e.key === '1'");
      expect(canvasCode).toContain("e.altKey && e.key === '2'");
      expect(canvasCode).toContain("e.altKey && e.key === '0'");
    });

    it('strictly satisfies Monochromatic Zinc continuum with ZERO purple and ZERO blue classes', () => {
      const forbiddenColorPatterns = [
        /\btext-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bbg-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bborder-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bfrom-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bto-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
        /\bring-(blue|indigo|purple|violet)-[0-9]{3}\b/g,
      ];

      for (const pattern of forbiddenColorPatterns) {
        const matchesCanvas = canvasCode.match(pattern);
        expect(matchesCanvas, `Found forbidden color classes in canvas: ${matchesCanvas?.join(', ')}`).toBeNull();
        const matchesEngine = engineCode.match(pattern);
        expect(matchesEngine, `Found forbidden color classes in engine: ${matchesEngine?.join(', ')}`).toBeNull();
      }
    });
  });
});
