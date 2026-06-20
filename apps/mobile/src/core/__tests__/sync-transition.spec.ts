// Unit tests for the pure sync-engine transition guards — flush only on the offline→online edge and on
// foreground (never repeatedly, never while offline).
import { shouldFlushOnConnectivity, shouldFlushOnAppState } from '../offline/sync-policy';

describe('shouldFlushOnConnectivity', () => {
  it('flushes on offline → online', () => expect(shouldFlushOnConnectivity(false, true)).toBe(true));
  it('does not flush while staying online', () => expect(shouldFlushOnConnectivity(true, true)).toBe(false));
  it('does not flush on going offline', () => expect(shouldFlushOnConnectivity(true, false)).toBe(false));
  it('does not flush while staying offline', () => expect(shouldFlushOnConnectivity(false, false)).toBe(false));
});

describe('shouldFlushOnAppState', () => {
  it('flushes on background → active when online', () => expect(shouldFlushOnAppState('background', 'active', true)).toBe(true));
  it('does not flush returning to foreground while offline', () => expect(shouldFlushOnAppState('background', 'active', false)).toBe(false));
  it('does not flush active → active', () => expect(shouldFlushOnAppState('active', 'active', true)).toBe(false));
  it('does not flush active → background', () => expect(shouldFlushOnAppState('active', 'background', true)).toBe(false));
});
