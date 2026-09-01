import { describe, it, expect } from 'vitest';
import {
  createJobAlertNotification,
  createProTipNotification,
  createContextGreetingNotification,
  clampMascotPosition,
  parseNotificationPayload,
  updateMascotState,
  PRO_TIPS
} from '../services/mascot-notification.js';
import { MascotState } from '../types/index.js';

describe('Hacky Mascot — Proactive Notification Alert System', () => {
  describe('createJobAlertNotification', () => {
    it('creates a job alert with multiple companies and formatted headline', () => {
      const notif = createJobAlertNotification(12, ['Stripe', 'Google', 'OpenAI'], 120);

      expect(notif.type).toBe('NEW_JOBS_ALERT');
      expect(notif.badge).toBe('🔥 New Openings');
      expect(notif.title).toBe('🔥 12 New 2026 Internships Added (Stripe, Google, OpenAI)!');
      expect(notif.body).toContain('Top roles open at Stripe, Google, OpenAI');
      expect(notif.ctaText).toBe('View Jobs 💼');
      expect(notif.targetTab).toBe('discovery');
      expect(notif.count).toBe(12);
      expect(notif.companies).toEqual(['Stripe', 'Google', 'OpenAI']);
      expect(notif.timestamp).toBeGreaterThan(0);
    });

    it('handles comma-separated string of companies', () => {
      const notif = createJobAlertNotification(5, 'Meta, Citadel, Databricks');

      expect(notif.title).toBe('🔥 5 New 2026 Internships Added (Meta, Citadel, Databricks)!');
      expect(notif.companies).toEqual(['Meta', 'Citadel', 'Databricks']);
      expect(notif.targetTab).toBe('discovery');
    });

    it('handles single company and empty company arrays gracefully', () => {
      const singleNotif = createJobAlertNotification(1, ['Apple']);
      expect(singleNotif.title).toBe('🔥 1 New 2026 Internships Added (Apple)!');
      expect(singleNotif.body).toContain('Top roles open at Apple');

      const emptyNotif = createJobAlertNotification(8, []);
      expect(emptyNotif.title).toBe('🔥 8 New 2026 Internships Added!');
      expect(emptyNotif.body).toContain('8 verified internship openings just synced');
      expect(emptyNotif.companies).toEqual([]);
    });

    it('clamps non-positive or missing count to minimum 1', () => {
      const zeroNotif = createJobAlertNotification(0, ['Uber']);
      expect(zeroNotif.count).toBe(1);
      expect(zeroNotif.title).toContain('1 New 2026 Internships Added');
    });
  });

  describe('createProTipNotification', () => {
    it('returns a valid pro-tip notification for a specified index', () => {
      const notif = createProTipNotification(0);

      expect(notif.type).toBe('PRO_TIP');
      expect(notif.badge).toContain('STAR Strategy');
      expect(notif.title).toBe('AI Resume Pro-Tip');
      expect(notif.body).toContain('STAR method');
      expect(notif.ctaText).toBe('Tailor Resume ⚡');
      expect(notif.targetTab).toBe('match');
    });

    it('returns a random pro-tip when index is omitted or out of bounds', () => {
      const notif = createProTipNotification();

      expect(notif.type).toBe('PRO_TIP');
      expect(notif.badge).toMatch(/^💡/);
      expect(PRO_TIPS.some(p => p.tip === notif.body)).toBe(true);

      const outOfBoundsNotif = createProTipNotification(999);
      expect(PRO_TIPS.some(p => p.tip === outOfBoundsNotif.body)).toBe(true);
    });
  });

  describe('createContextGreetingNotification', () => {
    it('creates Google Docs greeting with autoScan flag enabled', () => {
      const notif = createContextGreetingNotification('docs', { title: 'Alex Chen Resume 2026' });

      expect(notif.badge).toBe('Google Docs Connected');
      expect(notif.title).toBe('Google Doc Resume Detected!');
      expect(notif.body).toContain('Alex Chen Resume 2026');
      expect(notif.ctaText).toBe('Tailor with Hacky ⚡');
      expect(notif.targetTab).toBe('match');
      expect(notif.autoScan).toBe(true);
    });

    it('creates target role greeting for job listings', () => {
      const notif = createContextGreetingNotification('job', {
        title: 'SWE Intern',
        company: 'Stripe'
      });

      expect(notif.badge).toBe('Job Opening Ready');
      expect(notif.title).toBe('Target Role Detected!');
      expect(notif.body).toContain('"SWE Intern" at Stripe');
      expect(notif.ctaText).toBe('Tailor for This Job 🎯');
      expect(notif.targetTab).toBe('match');
    });

    it('creates autofill greeting for application forms', () => {
      const notif = createContextGreetingNotification('form');

      expect(notif.badge).toBe('Autofill Ready');
      expect(notif.title).toBe('Application Form Detected!');
      expect(notif.ctaText).toBe('Autofill Form Now ⚡');
      expect(notif.targetTab).toBe('tracker');
    });

    it('creates default AI Copilot greeting for general pages', () => {
      const notif = createContextGreetingNotification('general');

      expect(notif.badge).toBe('Hacky AI Active');
      expect(notif.title).toBe('Hacky at your service!');
      expect(notif.targetTab).toBe('match');
    });
  });

  describe('clampMascotPosition', () => {
    const viewport = { width: 1440, height: 900 };
    const mascotSize = { width: 76, height: 76 };
    const margin = 12;

    it('returns bottom-right default position when pos is null or invalid', () => {
      const defaultPos = clampMascotPosition(null, viewport, mascotSize, margin);
      expect(defaultPos.x).toBe(1440 - 76 - 24); // 1340
      expect(defaultPos.y).toBe(900 - 76 - 24); // 800

      const invalidPos = clampMascotPosition({ x: NaN, y: NaN } as any, viewport, mascotSize, margin);
      expect(invalidPos.x).toBe(1340);
      expect(invalidPos.y).toBe(800);
    });

    it('keeps valid coordinates within screen bounds untouched', () => {
      const pos = { x: 500, y: 400 };
      const clamped = clampMascotPosition(pos, viewport, mascotSize, margin);
      expect(clamped).toEqual({ x: 500, y: 400 });
    });

    it('clamps positions that overflow the right or bottom edges', () => {
      const overflowPos = { x: 2000, y: 1500 };
      const clamped = clampMascotPosition(overflowPos, viewport, mascotSize, margin);
      expect(clamped.x).toBe(1440 - 76 - 12); // 1352
      expect(clamped.y).toBe(900 - 76 - 12); // 812
    });

    it('clamps negative coordinates to safe margin', () => {
      const negativePos = { x: -100, y: -50 };
      const clamped = clampMascotPosition(negativePos, viewport, mascotSize, margin);
      expect(clamped.x).toBe(12);
      expect(clamped.y).toBe(12);
    });
  });

  describe('parseNotificationPayload', () => {
    it('parses NOTIFY_NEW_JOBS background runtime message', () => {
      const message = {
        type: 'NOTIFY_NEW_JOBS',
        count: 15,
        companies: ['Apple', 'Microsoft', 'NVIDIA'],
        totalCount: 200
      };

      const notif = parseNotificationPayload(message);
      expect(notif).not.toBeNull();
      expect(notif?.type).toBe('NEW_JOBS_ALERT');
      expect(notif?.count).toBe(15);
      expect(notif?.companies).toEqual(['Apple', 'Microsoft', 'NVIDIA']);
      expect(notif?.title).toContain('15 New 2026 Internships Added');
    });

    it('parses NOTIFY_ATS_TIP / SHOW_PRO_TIP message', () => {
      const message = {
        type: 'NOTIFY_ATS_TIP',
        tipIndex: 1
      };

      const notif = parseNotificationPayload(message);
      expect(notif).not.toBeNull();
      expect(notif?.type).toBe('PRO_TIP');
      expect(notif?.badge).toContain('ATS Optimization');
    });

    it('parses NOTIFY_CONTEXT_ALERT message', () => {
      const message = {
        type: 'NOTIFY_CONTEXT_ALERT',
        context: 'job',
        details: { title: 'Software Engineer', company: 'Google' }
      };

      const notif = parseNotificationPayload(message);
      expect(notif).not.toBeNull();
      expect(notif?.type).toBe('CONTEXT_ALERT');
      expect(notif?.body).toContain('Google');
    });

    it('returns null for unknown or non-object payloads', () => {
      expect(parseNotificationPayload(null)).toBeNull();
      expect(parseNotificationPayload('random string')).toBeNull();
      expect(parseNotificationPayload({ type: 'UNKNOWN_EVENT' })).toBeNull();
    });
  });

  describe('updateMascotState', () => {
    const initialState: MascotState = {
      isMinimized: false,
      position: { x: 100, y: 200 },
      hasInteracted: false,
      activeTipIndex: 0
    };

    it('updates partial state immutably', () => {
      const updated = updateMascotState(initialState, {
        isMinimized: true,
        hasInteracted: true
      });

      expect(updated.isMinimized).toBe(true);
      expect(updated.hasInteracted).toBe(true);
      expect(updated.position).toEqual({ x: 100, y: 200 });
      expect(initialState.isMinimized).toBe(false); // No mutation
    });

    it('allows clearing or updating position', () => {
      const newPosState = updateMascotState(initialState, { position: { x: 300, y: 400 } });
      expect(newPosState.position).toEqual({ x: 300, y: 400 });

      const nullPosState = updateMascotState(initialState, { position: null });
      expect(nullPosState.position).toBeNull();
    });
  });
});
