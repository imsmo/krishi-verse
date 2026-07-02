// Unit tests for the PURE worker-skills logic (screen 37).
import { skillCategory, groupByCategory, toggleSkill, skillEmoji, skillBadge, skillsDirty, type Skill } from '../../features/labour/worker-skills';

const sk = (id: string, code: string, name: string, tier: number, hazardous = false): Skill => ({ id, code, name, tier, parentId: null, hazardous });
const CAT: Skill[] = [
  sk('s1', 'sowing', 'Sowing', 1),
  sk('s2', 'harvesting', 'Harvesting', 1),
  sk('s3', 'irrigation', 'Irrigation', 2),
  sk('s4', 'tractor_operator', 'Tractor operator', 4),
];

describe('worker skills (screen 37)', () => {
  it('skillCategory buckets by tier', () => {
    expect(skillCategory(1)).toBe('crop');
    expect(skillCategory(2)).toBe('irrigation');
    expect(skillCategory(3)).toBe('specialised');
    expect(skillCategory(4)).toBe('specialised');
  });
  it('groupByCategory groups, orders, counts active, drops empties', () => {
    const g = groupByCategory(CAT, new Set(['s1', 's3']));
    expect(g.map((x) => x.key)).toEqual(['crop', 'irrigation', 'specialised']);
    expect(g[0].items.map((i) => i.skill.id)).toEqual(['s1', 's2']);
    expect(g[0].activeCount).toBe(1); // s1
    expect(g[1].activeCount).toBe(1); // s3
    expect(g[2].activeCount).toBe(0); // s4 inactive
  });
  it('toggleSkill adds then removes (new set)', () => {
    const a = toggleSkill(new Set(), 's1');
    expect(a.has('s1')).toBe(true);
    expect(toggleSkill(a, 's1').has('s1')).toBe(false);
  });
  it('skillEmoji maps by keyword, generic fallback', () => {
    expect(skillEmoji({ code: 'harvesting', name: 'Harvesting' })).toBe('🌾');
    expect(skillEmoji({ code: 'irrigation', name: 'Irrigation' })).toBe('💧');
    expect(skillEmoji({ code: 'tractor_operator', name: 'Tractor operator' })).toBe('🚜');
    expect(skillEmoji({ code: 'xyz', name: 'Mystery' })).toBe('🧰');
  });
  it('skillBadge from real fields: certification (tier≥4/hazardous), skilled (tier≥2), else null', () => {
    expect(skillBadge({ tier: 1, hazardous: false })).toBeNull();
    expect(skillBadge({ tier: 2, hazardous: false })).toBe('skilled');
    expect(skillBadge({ tier: 4, hazardous: false })).toBe('certification');
    expect(skillBadge({ tier: 1, hazardous: true })).toBe('certification');
  });
  it('skillsDirty detects add/remove vs saved', () => {
    expect(skillsDirty(['s1', 's2'], new Set(['s1', 's2']))).toBe(false);
    expect(skillsDirty(['s1'], new Set(['s1', 's2']))).toBe(true);
    expect(skillsDirty(['s1', 's2'], new Set(['s1']))).toBe(true);
    expect(skillsDirty(['s1'], new Set(['s2']))).toBe(true);
  });
});
