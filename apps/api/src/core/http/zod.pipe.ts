// core/http/zod.pipe.ts
// Validation pipes that run a zod schema over the request body / query and throw a
// structured 422 on failure. Centralizes validation so controllers stay declarative.
import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

function makePipe(schema: ZodSchema): PipeTransform {
  @Injectable()
  class ZodPipe implements PipeTransform {
    transform(value: unknown, _meta: ArgumentMetadata) {
      const r = schema.safeParse(value);
      if (!r.success) {
        const { ValidationError } = require('../../shared/errors/app-error');
        throw new ValidationError('Request validation failed', r.error.flatten());
      }
      return r.data;
    }
  }
  return new ZodPipe();
}
// Param decorators that bind a schema to the body/query argument.
import { Body, Query } from '@nestjs/common';
export const ZodBody = (schema: ZodSchema) => Body(makePipe(schema));
export const ZodQuery = (schema: ZodSchema) => Query(makePipe(schema));
