// apps/admin-api/src/core/http/zod.pipe.ts · validates request body/query against a zod .strict() schema and
// throws a 400 with the field issues on failure. Param decorators @ZodBody / @ZodQuery bind + validate in one.
import { BadRequestException } from '@nestjs/common';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ZodSchema } from 'zod';

function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const r = schema.safeParse(data ?? {});
  if (!r.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  return r.data;
}
export const ZodBody = <T>(schema: ZodSchema<T>) =>
  createParamDecorator((_d: unknown, ctx: ExecutionContext) => parse(schema, ctx.switchToHttp().getRequest().body))();
export const ZodQuery = <T>(schema: ZodSchema<T>) =>
  createParamDecorator((_d: unknown, ctx: ExecutionContext) => parse(schema, ctx.switchToHttp().getRequest().query))();
