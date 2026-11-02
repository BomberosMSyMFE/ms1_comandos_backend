import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolUsuario } from '../../../domain/value-objects/rol-usuario.vo';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.rol) {
      throw new ForbiddenException('No posee permisos para ejecutar esta acción.');
    }

    const hasRole = requiredRoles.includes(user.rol as RolUsuario);
    if (!hasRole) {
      throw new ForbiddenException(
        `Rol '${user.rol}' insuficiente. Roles autorizados: [${requiredRoles.join(', ')}].`,
      );
    }

    return true;
  }
}
