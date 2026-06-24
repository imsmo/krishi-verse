// apps/web-admin/src/test/model.spec.ts · unit tests for the pure AI-model registry helpers.
import {
  MODEL_STATUSES, isModelStatus, canTransition, transitionTargets, isServing, isTerminal,
  modelStatusKey, modelStatusTone, parseThreshold, validReason, formatThreshold4, formatPercent2,
  buildPromote, buildTuneThreshold, ModelActionError,
} from '../features/ai-models/model';

describe('model state machine', () => {
  it('has the four statuses', () => {
    expect(MODEL_STATUSES).toEqual(['shadow', 'canary', 'production', 'retired']);
  });
  it('allows only real transitions', () => {
    expect(canTransition('shadow', 'canary')).toBe(true);
    expect(canTransition('shadow', 'production')).toBe(true);
    expect(canTransition('canary', 'production')).toBe(true);
    expect(canTransition('production', 'canary')).toBe(true);
    expect(canTransition('production', 'retired')).toBe(true);
    expect(canTransition('retired', 'shadow')).toBe(false);
    expect(canTransition('shadow', 'shadow')).toBe(false);
  });
  it('lists legal targets', () => {
    expect(transitionTargets('shadow')).toEqual(['canary', 'production', 'retired']);
    expect(transitionTargets('retired')).toEqual([]);
  });
  it('serving + terminal + tone', () => {
    expect(isServing('canary')).toBe(true);
    expect(isServing('production')).toBe(true);
    expect(isServing('shadow')).toBe(false);
    expect(isTerminal('retired')).toBe(true);
    expect(isModelStatus('canary')).toBe(true);
    expect(isModelStatus('nope')).toBe(false);
    expect(modelStatusKey('canary')).toBe('aiModels.st.canary');
    expect(modelStatusKey('nope')).toBe('aiModels.st.unknown');
    expect(modelStatusTone('production')).toBe('ok');
    expect(modelStatusTone('canary')).toBe('warn');
    expect(modelStatusTone('shadow')).toBe('muted');
  });
});

describe('threshold parse + format', () => {
  it('blank → null, valid decimals, range + format rejection', () => {
    expect(parseThreshold('')).toBeNull();
    expect(parseThreshold('0')).toBe(0);
    expect(parseThreshold('1')).toBe(1);
    expect(parseThreshold('0.75')).toBe(0.75);
    expect(parseThreshold('0.9999')).toBe(0.9999);
    expect(() => parseThreshold('1.5')).toThrow(ModelActionError);
    expect(() => parseThreshold('0.12345')).toThrow();
    expect(() => parseThreshold('.5')).toThrow();
    expect(() => parseThreshold('abc')).toThrow();
  });
  it('reason bounds', () => {
    expect(validReason(' ok ')).toBe('ok');
    expect(() => validReason('')).toThrow();
  });
  it('float-free formatters', () => {
    expect(formatThreshold4(null)).toBeNull();
    expect(formatThreshold4(0.75)).toBe('0.7500');
    expect(formatThreshold4(1)).toBe('1.0000');
    expect(formatThreshold4(0.9999)).toBe('0.9999');
    expect(formatPercent2(0)).toBe('0.00%');
    expect(formatPercent2(0.1234)).toBe('12.34%');
    expect(formatPercent2(1)).toBe('100.00%');
  });
});

describe('builders', () => {
  it('promote enforces transition', () => {
    expect(buildPromote('shadow', 'canary', 'ramp up')).toEqual({ to: 'canary', reason: 'ramp up' });
    expect(() => buildPromote('retired', 'shadow', 'nope')).toThrow(ModelActionError);
    expect(() => buildPromote('shadow', 'bogus', 'nope')).toThrow();
    expect(() => buildPromote('shadow', 'canary', '')).toThrow();
  });
  it('tune threshold (nullable)', () => {
    expect(buildTuneThreshold('0.8', 'tighten')).toEqual({ confidenceThreshold: 0.8, reason: 'tighten' });
    expect(buildTuneThreshold('', 'clear it')).toEqual({ confidenceThreshold: null, reason: 'clear it' });
    expect(() => buildTuneThreshold('2', 'bad')).toThrow();
  });
});
