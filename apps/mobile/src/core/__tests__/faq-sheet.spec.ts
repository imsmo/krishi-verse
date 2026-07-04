// Unit tests for the PURE FAQ cheat-sheet derivations (features/ambassador/faq-sheet, screen 167). The counts are
// real (catalog-derived), never a hardcoded "20"; the filter is a pure category + case-insensitive query filter.
import { FAQ_CATALOG, FAQ_CATEGORIES, faqCategoryCounts, filterFaqs, type ResolvedFaq } from '../../features/ambassador/faq-sheet';

describe('FAQ_CATALOG', () => {
  it('has unique ids and every category is a known one', () => {
    const ids = FAQ_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of FAQ_CATALOG) expect(FAQ_CATEGORIES).toContain(e.category);
  });
});

describe('faqCategoryCounts', () => {
  it('all = catalog length and per-category sums add up', () => {
    const c = faqCategoryCounts();
    expect(c.all).toBe(FAQ_CATALOG.length);
    expect(c.signup + c.money + c.safety + c.trust).toBe(c.all);
  });
  it('counts a small custom catalog', () => {
    const c = faqCategoryCounts([{ id: 'a', category: 'money' }, { id: 'b', category: 'money' }, { id: 'c', category: 'trust' }]);
    expect(c).toEqual({ all: 3, signup: 0, money: 2, safety: 0, trust: 1 });
  });
});

describe('filterFaqs', () => {
  const list: ResolvedFaq[] = [
    { id: 'm', category: 'money', q: 'How do I get my money?', a: 'Direct to bank via UPI.' },
    { id: 's', category: 'safety', q: 'Is my Aadhaar safe?', a: 'Yes, never stored raw.' },
    { id: 't', category: 'trust', q: 'What if buyer does not pay?', a: 'Escrow protects you.' },
  ];
  it("category 'all' with empty query returns everything, in order", () => {
    expect(filterFaqs(list, 'all', '').map((f) => f.id)).toEqual(['m', 's', 't']);
  });
  it('filters by category', () => {
    expect(filterFaqs(list, 'safety', '').map((f) => f.id)).toEqual(['s']);
  });
  it('case-insensitive query matches question or answer', () => {
    expect(filterFaqs(list, 'all', 'AADHAAR').map((f) => f.id)).toEqual(['s']);
    expect(filterFaqs(list, 'all', 'escrow').map((f) => f.id)).toEqual(['t']);
    expect(filterFaqs(list, 'all', '  upi ').map((f) => f.id)).toEqual(['m']);
    expect(filterFaqs(list, 'all', 'zzz')).toEqual([]);
  });
  it('combines category + query', () => {
    expect(filterFaqs(list, 'money', 'bank').map((f) => f.id)).toEqual(['m']);
    expect(filterFaqs(list, 'trust', 'bank')).toEqual([]);
  });
});
