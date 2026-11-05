import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { TacticalLoggerService } from './tactical-logger.service';

@Injectable()
export class TacticalLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: TacticalLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const method = request.method;
    const url = request.originalUrl || request.url;
    const ip = request.ip || request.socket.remoteAddress || '127.0.0.1';
    const user = (request as any).user;
    const userIdentifier = user ? `${user.email} (${user.rol})` : 'ANONIMO';
    const startTime = Date.now();

    this.logger.log(
      'HTTP-REQUEST',
      `--> [${method}] ${url} | Operador: ${userIdentifier} | IP: ${ip}`,
      { method, url, user: user?.email, ip },
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          this.logger.log(
            'HTTP-RESPONSE',
            `<-- [${method}] ${url} [${statusCode}] | Duración: ${duration}ms | Operador: ${userIdentifier}`,
            { method, url, statusCode, durationMs: duration, user: user?.email },
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const status = err.status || 500;
          this.logger.warn(
            'HTTP-ERROR',
            `<!- [${method}] ${url} [${status}] | Duración: ${duration}ms | Error: ${err.message}`,
            { method, url, status, durationMs: duration, error: err.message },
          );
        },
      }),
    );
  }
}
