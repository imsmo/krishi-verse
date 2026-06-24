// apps/web-partner/src/features/logistics/shipment.ts · PURE helpers for the 3PL shipment delivery lifecycle.
// Mirrors apps/api logistics shipment.state (the shipment_status state machine, Law 5) + the shipments controller's
// action payloads EXACTLY. No I/O, no React. The UI offers a lifecycle action ONLY when the state machine says the
// transition is legal; the API re-enforces it (a 409 still degrades to a notice). Money (charge/COD) is rendered by
// the page via formatMoneyMinor from bigint-minor strings — never here.

// ---- status state machine (mirror shipment.state.ts) -------------------------------------------------------------
export const SHIPMENT_STATUSES = [
  'pending', 'assigned', 'pickup_scheduled', 'picked_up', 'in_transit', 'at_hub',
  'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = Object.freeze({
  pending:          ['assigned', 'cancelled'],
  assigned:         ['pickup_scheduled', 'picked_up', 'cancelled'],
  pickup_scheduled: ['picked_up', 'cancelled', 'failed'],
  picked_up:        ['in_transit', 'at_hub', 'out_for_delivery', 'failed'],
  in_transit:       ['at_hub', 'out_for_delivery', 'failed'],
  at_hub:           ['in_transit', 'out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  failed:           ['out_for_delivery', 'returned', 'cancelled'],
  delivered:        [],
  returned:         [],
  cancelled:        [],
});

export function isShipmentStatus(v: string | undefined): v is ShipmentStatus {
  return !!v && (SHIPMENT_STATUSES as readonly string[]).includes(v);
}
export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function isTerminal(s: ShipmentStatus): boolean { return s === 'delivered' || s === 'returned' || s === 'cancelled'; }
export function isPrePickup(s: ShipmentStatus): boolean { return s === 'pending' || s === 'assigned' || s === 'pickup_scheduled'; }

export function statusKey(s: string): string { return isShipmentStatus(s) ? `ship.status.${s}` : 'ship.status.unknown'; }
export function statusTone(s: string): 'ok' | 'warn' | 'info' | 'danger' | 'muted' {
  switch (s) {
    case 'delivered': return 'ok';
    case 'failed': return 'danger';
    case 'out_for_delivery': return 'info';
    case 'assigned': case 'pickup_scheduled': return 'info';
    case 'picked_up': case 'in_transit': case 'at_hub': return 'warn';
    default: return 'muted'; // pending / returned / cancelled
  }
}

// ---- list filter (mirror query-shipment.dto) --------------------------------------------------------------------
export const SHIPMENT_BOXES = ['all', 'mine'] as const;
export type ShipmentBox = (typeof SHIPMENT_BOXES)[number];
export function isShipmentBox(v: string | undefined): v is ShipmentBox {
  return !!v && (SHIPMENT_BOXES as readonly string[]).includes(v);
}
export function boxKey(b: ShipmentBox): string { return `ship.box.${b}`; }

export interface ListQuery { box: ShipmentBox; status?: ShipmentStatus; cursor?: string; limit: number; }
export function buildListQuery(sp: { box?: string; status?: string; cursor?: string }): ListQuery {
  return {
    box: isShipmentBox(sp.box) ? sp.box : 'all',
    status: isShipmentStatus(sp.status) ? sp.status : undefined,
    cursor: sp.cursor && sp.cursor.trim() !== '' ? sp.cursor : undefined,
    limit: 20,
  };
}
export function shipmentsHref(box: ShipmentBox, status?: ShipmentStatus, cursor?: string): string {
  const p = new URLSearchParams();
  if (box !== 'all') p.set('box', box);
  if (status) p.set('status', status);
  if (cursor) p.set('cursor', cursor);
  const qs = p.toString();
  return qs ? `/shipments?${qs}` : '/shipments';
}

// ---- lifecycle actions (mirror the shipments controller's POST :id/* verbs) -------------------------------------
export type ActionBody = 'none' | 'assign' | 'schedule' | 'deliver' | 'fail';
export interface LifecycleAction { key: string; endpoint: string; target: ShipmentStatus; body: ActionBody; }

/** Every lifecycle verb the portal exposes, in workflow order. `target` drives legality via the state machine. */
export const LIFECYCLE_ACTIONS: readonly LifecycleAction[] = [
  { key: 'assign',         endpoint: 'assign',           target: 'assigned',         body: 'assign' },
  { key: 'schedulePickup', endpoint: 'schedule-pickup',  target: 'pickup_scheduled', body: 'schedule' },
  { key: 'pickedUp',       endpoint: 'picked-up',        target: 'picked_up',        body: 'none' },
  { key: 'inTransit',      endpoint: 'in-transit',       target: 'in_transit',       body: 'none' },
  { key: 'atHub',          endpoint: 'at-hub',           target: 'at_hub',           body: 'none' },
  { key: 'outForDelivery', endpoint: 'out-for-delivery', target: 'out_for_delivery', body: 'none' },
  { key: 'deliver',        endpoint: 'deliver',          target: 'delivered',        body: 'deliver' },
  { key: 'fail',           endpoint: 'fail',             target: 'failed',           body: 'fail' },
  { key: 'cancel',         endpoint: 'cancel',           target: 'cancelled',        body: 'none' },
];
/** The actions that are legal from the current status (state machine is the authority; API re-checks). */
export function availableActions(status: ShipmentStatus): LifecycleAction[] {
  return LIFECYCLE_ACTIONS.filter((a) => canTransition(status, a.target));
}
export function actionByKey(key: string): LifecycleAction | undefined {
  return LIFECYCLE_ACTIONS.find((a) => a.key === key);
}

// ---- field validation + builders (mirror update-shipment.dto) ---------------------------------------------------
export class ShipmentError extends Error {
  constructor(public readonly fieldKey: string) { super(fieldKey); this.name = 'ShipmentError'; }
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS_RE = /^\d+$/;
const OTP_RE = /^\d{4,8}$/;
const LOCAL_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function optUuid(raw: string | undefined, key: string): string | undefined {
  const v = (raw ?? '').trim();
  if (v === '') return undefined;
  if (!UUID_RE.test(v)) throw new ShipmentError(key);
  return v;
}

export interface AssignBody { partnerId?: string; vehicleId?: string; riderUserId?: string; awbNo?: string; }
export function buildAssign(f: { partnerId?: string; vehicleId?: string; riderUserId?: string; awbNo?: string }): AssignBody {
  const body: AssignBody = {};
  const partnerId = optUuid(f.partnerId, 'partnerId');
  const vehicleId = optUuid(f.vehicleId, 'vehicleId');
  const riderUserId = optUuid(f.riderUserId, 'riderUserId');
  if (partnerId) body.partnerId = partnerId;
  if (vehicleId) body.vehicleId = vehicleId;
  if (riderUserId) body.riderUserId = riderUserId;
  if (!body.partnerId && !body.vehicleId && !body.riderUserId) throw new ShipmentError('assignTarget');
  const awb = (f.awbNo ?? '').trim();
  if (awb !== '') { if (awb.length > 60) throw new ShipmentError('awbNo'); body.awbNo = awb; }
  return body;
}

export interface SchedulePickupBody { scheduledPickupAt: string; windowMins?: number; }
export function buildSchedulePickup(f: { scheduledPickupAt: string; windowMins?: string }): SchedulePickupBody {
  const at = (f.scheduledPickupAt ?? '').trim();
  if (!LOCAL_DT_RE.test(at)) throw new ShipmentError('scheduledPickupAt');
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) throw new ShipmentError('scheduledPickupAt');
  const body: SchedulePickupBody = { scheduledPickupAt: d.toISOString() };
  const w = (f.windowMins ?? '').trim();
  if (w !== '') {
    if (!DIGITS_RE.test(w)) throw new ShipmentError('windowMins');
    const n = +w;
    if (n < 0 || n > 1440) throw new ShipmentError('windowMins');
    body.windowMins = n;
  }
  return body;
}

export interface DeliverBody { otp: string; podMediaId?: string; }
export function buildDeliver(f: { otp: string; podMediaId?: string }): DeliverBody {
  const otp = (f.otp ?? '').trim();
  if (!OTP_RE.test(otp)) throw new ShipmentError('otp');
  const body: DeliverBody = { otp };
  const pod = optUuid(f.podMediaId, 'podMediaId');
  if (pod) body.podMediaId = pod;
  return body;
}

export interface FailBody { reason: string; }
export function buildFail(f: { reason: string }): FailBody {
  const reason = (f.reason ?? '').trim();
  if (reason.length < 1 || reason.length > 500) throw new ShipmentError('reason');
  return { reason };
}

// ---- read-model type (mirror ShipmentProps; money is bigint-minor STRINGS over the wire) ------------------------
export interface ShipmentRow {
  id: string; orderId: string; status: string; partnerId: string | null; vehicleId: string | null;
  riderUserId: string | null; awbNo: string | null; scheduledPickupAt: string | null; scheduledWindowMins: number | null;
  pickedUpAt: string | null; deliveredAt: string | null; podMediaId: string | null;
  chargeMinor: string | null; codMinor: string | null; requiresColdChain: boolean; createdAt: string;
}
