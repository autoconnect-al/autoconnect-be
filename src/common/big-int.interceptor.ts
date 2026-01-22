import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return next.handle().pipe(map((data) => this.convertBigInt(data)));
  }

  private convertBigInt(value: any): any {
    if (typeof value === 'bigint') return value.toString();
    if (value === null || value === undefined) return value;

    // Preserve primitives
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return value;

    // Preserve some built-ins
    if (value instanceof Date) return value;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value;

    // Map / Set support
    if (value instanceof Map) {
      const obj: Record<string, any> = {};
      for (const [k, v] of value.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        obj[String(k)] = this.convertBigInt(v);
      }
      return obj;
    }

    if (value instanceof Set) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Array.from(value.values()).map((v) => this.convertBigInt(v));
    }

    // Array
    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.map((v) => this.convertBigInt(v));
    }

    // If it's not a plain object, leave it alone (important for streams, errors, class instances, etc.)
    if (!this.isPlainObject(value)) return value;

    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      out[k] = this.convertBigInt(v);
    }
    return out;
  }

  private isPlainObject(value: any): value is Record<string, any> {
    if (value === null || typeof value !== 'object') return false;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
}
