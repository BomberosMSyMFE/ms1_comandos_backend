import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtTokenService } from '../jwt-token.service';
import { EnvConfig } from '../../config/env.config';
import { TacticalLoggerService } from '../../logging/tactical-logger.service';

@Injectable()
export class JwtCookieAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: JwtTokenService,
    private readonly logger: TacticalLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extraerToken(request);

    if (!token) {
      this.logger.warn(
        'AUTH-GUARD',
        `[NO_TOKEN] Acceso no autorizado en '${request.method} ${request.originalUrl || request.url}' desde IP ${request.ip || '127.0.0.1'}. Sin cookie '${EnvConfig.cookieName}' ni Bearer header.`,
      );
      throw new UnauthorizedException(
        'Acceso no autorizado: No se encontró cookie de sesión HttpOnly ni Bearer token.',
      );
    }

    try {
      const payload = await this.tokenService.verificarToken(token);
      request['user'] = {
        id: payload.sub,
        email: payload.email,
        rol: payload.rol,
      };
      this.logger.debug?.(
        'AUTH-GUARD',
        `[TOKEN_VALIDO] Usuario '${payload.email}' [${payload.rol}] autenticado para '${request.method} ${request.originalUrl || request.url}'.`,
      );
      return true;
    } catch {
      this.logger.warn(
        'AUTH-GUARD',
        `[TOKEN_INVALIDO] Token expirado o firma corrupta en '${request.method} ${request.originalUrl || request.url}'.`,
      );
      throw new UnauthorizedException('Sesión inválida o expirada. Por favor inicie sesión nuevamente.');
    }
  }

  private extraerToken(request: Request): string | null {
    // 1. Prioridad: Cookie HttpOnly emitida por el SSO
    if (request.cookies && request.cookies[EnvConfig.cookieName]) {
      return request.cookies[EnvConfig.cookieName];
    }

    // 2. Fallback: Cabecera Authorization Bearer (para pruebas en Swagger / Postman)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}

