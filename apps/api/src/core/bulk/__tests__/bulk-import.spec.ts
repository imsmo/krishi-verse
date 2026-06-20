// core/bulk/__tests__/bulk-import.spec.ts · unit tests (pure/mocked) for the bulk-import platform.
// Covers: the RFC-4180 CSV parser (quotes, embedded commas/newlines, CRLF, bad headers, bounds); the job state
// machine; the applier registry; and the processor (claim → parse → per-row apply → capped error recording →
// terminal status) with fakes.
import { parseCsv, recordToRow, DEFAULT_CSV_LIMITS } from '../csv-parser';
import { BulkImportJob } from '../domain/bulk-import-job.entity';
import * as state from '../domain/bulk-import.state';
import { IllegalBulkTransitionError } from '../domain/bulk-import.state';
import { CsvParseError } from '../domain/bulk-import.errors';
import { BulkApplierRegistry } from '../bulk-applier.registry';
import { BulkImportProcessor } from '../csv-import.processor';

describe('CSV parser', () => {
  it('parses quoted fields with embedded commas, quotes and CRLF', () => {
    const csv = 'name,note\r\n"Tomato, red","a ""good"" one"\r\nUrea,plain\r\n';
    const { header, records } = parseCsv(csv);
    expect(header).toEqual(['name', 'note']);
    expect(records[0]).toEqual(['Tomato, red', 'a "good" one']);
    expect(records[1]).toEqual(['Urea', 'plain']);
  });
  it('rejects empty / blank-header / duplicate-header / unterminated-quote files', () => {
    expect(() => parseCsv('')).toThrow(CsvParseError);
    expect(() => parseCsv('a,,c\n1,2,3')).toThrow(/blank column/);
    expect(() => parseCsv('a,a\n1,2')).toThrow(/duplicate column/);
    expect(() => parseCsv('a,b\n"x,y')).toThrow(/unterminated/);
  });
  it('enforces row bound (DoS guard)', () => {
    const rows = ['h', ...Array.from({ length: 5 }, (_, i) => String(i))].join('\n');
    expect(() => parseCsv(rows, { ...DEFAULT_CSV_LIMITS, maxRows: 3 })).toThrow(/exceeds 3 data rows/);
  });
  it('recordToRow maps by header + flags length mismatch', () => {
    expect(recordToRow(['a', 'b'], ['1', '2'])).toEqual({ row: { a: '1', b: '2' }, lengthMismatch: false });
    expect(recordToRow(['a', 'b'], ['1']).lengthMismatch).toBe(true);
    expect(recordToRow(['a', 'b'], ['1']).row).toEqual({ a: '1', b: '' });
  });
});

describe('BulkImportJob state machine', () => {
  const make = () => BulkImportJob.create({ id: 'j1', tenantId: 't1', importType: 'products', storageKey: 'k', requestedBy: 'u1' });
  it('create emits bulk.import_created; begin→finish emits completed', () => {
    const j = make();
    expect(j.pullEvents().some((e) => e.type === 'bulk.import_created')).toBe(true);
    j.begin(2); j.recordProgress(2, 2, 0); j.finish();
    expect(j.status).toBe('completed');
    expect(j.pullEvents().some((e) => e.type === 'bulk.import_completed')).toBe(true);
  });
  it('terminalFor: all-ok=completed, all-fail=failed, mixed=partially_completed', () => {
    expect(state.terminalFor(5, 0)).toBe('completed');
    expect(state.terminalFor(0, 5)).toBe('failed');
    expect(state.terminalFor(3, 2)).toBe('partially_completed');
  });
  it('illegal transition throws; terminal is final', () => {
    const j = make(); j.begin(1); j.recordProgress(1, 1, 0); j.finish();
    expect(() => j.cancel()).toThrow(IllegalBulkTransitionError);
  });
  it('pending can cancel; fail from processing', () => {
    const a = make(); a.cancel(); expect(a.status).toBe('cancelled');
    const b = make(); b.begin(1); b.fail('boom'); expect(b.status).toBe('failed');
  });
});

describe('BulkApplierRegistry', () => {
  it('registers + resolves by type; rejects duplicates', () => {
    const reg = new BulkApplierRegistry();
    const applier = { importType: 'products', requiredColumns: ['name'], applyRow: jest.fn() };
    reg.register(applier);
    expect(reg.get('products')).toBe(applier);
    expect(reg.has('products')).toBe(true);
    expect(() => reg.register(applier)).toThrow(/duplicate/);
  });
});

describe('BulkImportProcessor', () => {
  const metrics = { inc: jest.fn(), observe: jest.fn() } as any;
  function harness(csv: string, applier: any) {
    const job = BulkImportJob.create({ id: 'j1', tenantId: 't1', importType: 'products', storageKey: 'k', requestedBy: 'u1' });
    const tx = { query: jest.fn() };
    const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
    const outbox = { write: jest.fn() };
    const objects = { getObject: jest.fn(async () => Buffer.from(csv, 'utf8')) };
    const registry = new BulkApplierRegistry(); if (applier) registry.register(applier);
    const repo = { getForUpdate: jest.fn(async () => job), update: jest.fn() };
    const results = { recordError: jest.fn() };
    const proc = new BulkImportProcessor(uow as any, outbox as any, metrics, objects as any, registry as any, repo as any, results as any);
    return { proc, job, results, objects };
  }
  const applier = { importType: 'products', requiredColumns: ['name'], applyRow: jest.fn(async (_c: any, _k: string, row: any) => { if (row.name === 'BAD') throw Object.assign(new Error('bad row'), { code: 'X' }); return { id: 'p' }; }) };

  it('processes rows: 2 ok + 1 failed → partially_completed, error recorded', async () => {
    const h = harness('name\nok1\nok2\nBAD\n', applier);
    const out = await h.proc.process('t1', 'j1');
    expect(out).toMatchObject({ status: 'partially_completed', succeeded: 2, failed: 1 });
    expect(h.results.recordError).toHaveBeenCalledTimes(1);
    expect(h.job.status).toBe('partially_completed');
  });
  it('missing required columns → job failed (fatal), no rows applied', async () => {
    applier.applyRow.mockClear();
    const h = harness('wrongcol\nx\n', applier);
    const out = await h.proc.process('t1', 'j1');
    expect(out.status).toBe('failed');
    expect(applier.applyRow).not.toHaveBeenCalled();
    expect(h.job.status).toBe('failed');
  });
  it('all rows ok → completed', async () => {
    const h = harness('name\nok1\nok2\n', applier);
    const out = await h.proc.process('t1', 'j1');
    expect(out).toMatchObject({ status: 'completed', succeeded: 2, failed: 0 });
  });
});
