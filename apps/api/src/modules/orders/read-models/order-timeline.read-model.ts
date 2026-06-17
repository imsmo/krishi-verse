// modules/orders/read-models/order-timeline.read-model.ts
// CQRS read path (Law 12): buyer/seller order history on the replica, keyset (cursor) paginated
// on (created_at,id) — which also prunes the recent order partitions. Never OFFSET.
import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../repositories/order.repository';
import { QueryOrderDto } from '../dto/query-order.dto';

const enc = (s: string) => Buffer.from(s).toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

@Injectable()
export class OrderTimelineReadModel {
  constructor(private readonly repo: OrderRepository) {}
  async list(tenantId: string, userId: string, q: QueryOrderDto) {
    let cursor: { c: string; id: string } | undefined;
    if (q.cursor) { try { cursor = JSON.parse(dec(q.cursor)); } catch { /* first page */ } }
    const rows = await this.repo.listFor(tenantId, q.role, userId, { status: q.status, cursor, limit: q.limit + 1 });
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const items = page.map((o) => { const p = o.toProps(); return { id: p.id, orderNo: p.orderNo, status: p.status, totalMinor: p.totalMinor.toString(), counterparty: q.role === 'buyer' ? p.sellerUserId : p.buyerUserId, createdAt: p.createdAt }; });
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? enc(JSON.stringify({ c: new Date(last.toProps().createdAt).toISOString(), id: last.id })) : null;
    return { items, nextCursor };
  }
}
