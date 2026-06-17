// core/resilience/resilience.errors.ts · typed infra errors (503, stable codes).
import { InfraError } from '../../shared/errors/app-error';

/** A dependency call exceeded its time budget. */
export class TimeoutError extends InfraError {
  constructor(dep: string, ms: number) { super('DEP_TIMEOUT', `Dependency '${dep}' timed out after ${ms}ms`, { dep, ms }); }
}
/** The circuit for a dependency is OPEN — we are deliberately not calling it. */
export class CircuitOpenError extends InfraError {
  constructor(dep: string) { super('DEP_CIRCUIT_OPEN', `Dependency '${dep}' is unavailable (circuit open)`, { dep }); }
}
/** The dependency's bulkhead (concurrency + queue) is saturated — shed load. */
export class BulkheadFullError extends InfraError {
  constructor(dep: string) { super('DEP_BULKHEAD_FULL', `Dependency '${dep}' is overloaded (bulkhead full)`, { dep }); }
}
