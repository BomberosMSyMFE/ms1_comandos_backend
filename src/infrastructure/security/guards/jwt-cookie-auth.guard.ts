import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtTokenService } from '../jwt-token.service';
import { EnvConfig } from '../../config/env.config';

@Injectable()
export class JwtCookieAuthGuard implements CanActivate {
  constructor(private readonly tokenService: JwtTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extraerToken(request);

    if (!token) {
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
      return true;
    } catch {
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
