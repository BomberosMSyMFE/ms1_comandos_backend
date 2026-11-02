import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../../domain/value-objects/rol-usuario.vo';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
