import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next
      .handle()
      .pipe(
        map((data) =>
          JSON.parse(
            JSON.stringify(data, (_, v) =>
              typeof v === 'bigint' ? v.toString() : v,
            ),
          ),
        ),
      );
  }
}
