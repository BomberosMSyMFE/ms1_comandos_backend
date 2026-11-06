import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ROLES_KEY } from '../security/decorators/roles.decorator';
import { RolesGuard } from '../security/guards/roles.guard';
import { RolUsuario } from '../../domain/value-objects/rol-usuario.vo';
import { IncidentesController } from './incidentes.controller';
import { ReportesController } from './reportes.controller';
import { DespachoController } from './despacho.controller';

describe('RBAC Roles Controller Tests (Nataly - MS-01)', () => {
  const reflector = new Reflector();
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (handler: any, userRole: RolUsuario | null): ExecutionContext => {
    return {
      getHandler: () => handler,
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userRole ? { id: 'test-user-id', rol: userRole } : null,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('IncidentesController RBAC', () => {
    it('debe permitir únicamente OPERADOR y ADMINISTRADOR en listarActivos (BOMBERO excluido)', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, IncidentesController.prototype.listarActivos);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]);
      expect(roles).not.toContain(RolUsuario.BOMBERO);
    });

    it('debe permitir únicamente OPERADOR y ADMINISTRADOR en obtenerKpisTacticos (BOMBERO excluido)', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, IncidentesController.prototype.obtenerKpisTacticos);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]);
      expect(roles).not.toContain(RolUsuario.BOMBERO);
    });

    it('debe permitir únicamente OPERADOR y ADMINISTRADOR en obtenerTimeline (BOMBERO excluido)', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, IncidentesController.prototype.obtenerTimeline);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]);
      expect(roles).not.toContain(RolUsuario.BOMBERO);
    });

    it('debe permitir únicamente OPERADOR y ADMINISTRADOR en obtenerDespachos (BOMBERO excluido)', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, IncidentesController.prototype.obtenerDespachos);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]);
      expect(roles).not.toContain(RolUsuario.BOMBERO);
    });

    it('debe permitir únicamente OPERADOR y ADMINISTRADOR en registrar incidente', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, IncidentesController.prototype.registrar);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]);
      expect(roles).not.toContain(RolUsuario.BOMBERO);
    });

    it('debe permitir únicamente OPERADOR y ADMINISTRADOR en cambiarEstado (BOMBERO excluido)', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, IncidentesController.prototype.cambiarEstado);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]);
      expect(roles).not.toContain(RolUsuario.BOMBERO);
    });

    it('debe rechazar con ForbiddenException si un BOMBERO intenta acceder a listarActivos', () => {
      const context = createMockContext(IncidentesController.prototype.listarActivos, RolUsuario.BOMBERO);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debe rechazar con ForbiddenException si un BOMBERO intenta actualizar estado', () => {
      const context = createMockContext(IncidentesController.prototype.cambiarEstado, RolUsuario.BOMBERO);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debe permitir acceso a OPERADOR en listarActivos', () => {
      const context = createMockContext(IncidentesController.prototype.listarActivos, RolUsuario.OPERADOR);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('debe permitir acceso a ADMINISTRADOR en listarActivos', () => {
      const context = createMockContext(IncidentesController.prototype.listarActivos, RolUsuario.ADMINISTRADOR);
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('ReportesController RBAC', () => {
    it('debe permitir OPERADOR, BOMBERO y ADMINISTRADOR en listar', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, ReportesController.prototype.listar);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.BOMBERO, RolUsuario.ADMINISTRADOR]);
      expect(roles).toContain(RolUsuario.BOMBERO);
    });

    it('debe permitir OPERADOR, BOMBERO y ADMINISTRADOR en obtenerPorId', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, ReportesController.prototype.obtenerPorId);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.BOMBERO, RolUsuario.ADMINISTRADOR]);
      expect(roles).toContain(RolUsuario.BOMBERO);
    });

    it('debe permitir acceso a BOMBERO al catálogo de reportes', () => {
      const context = createMockContext(ReportesController.prototype.listar, RolUsuario.BOMBERO);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('debe permitir acceso a BOMBERO al detalle de un reporte', () => {
      const context = createMockContext(ReportesController.prototype.obtenerPorId, RolUsuario.BOMBERO);
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('DespachoController RBAC (Transacciones SAGA)', () => {
    it('debe permitir únicamente OPERADOR y ADMINISTRADOR en iniciarDespacho', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, DespachoController.prototype.iniciarDespacho);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]);
      expect(roles).not.toContain(RolUsuario.BOMBERO);
    });

    it('debe permitir únicamente OPERADOR y ADMINISTRADOR en obtenerAuditoriaSaga', () => {
      const roles = reflector.get<RolUsuario[]>(ROLES_KEY, DespachoController.prototype.obtenerAuditoriaSaga);
      expect(roles).toEqual([RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR]);
      expect(roles).not.toContain(RolUsuario.BOMBERO);
    });

    it('debe rechazar con ForbiddenException si un BOMBERO intenta iniciar despacho SAGA', () => {
      const context = createMockContext(DespachoController.prototype.iniciarDespacho, RolUsuario.BOMBERO);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debe rechazar con ForbiddenException si un BOMBERO intenta consultar bitácora de auditoría SAGA', () => {
      const context = createMockContext(DespachoController.prototype.obtenerAuditoriaSaga, RolUsuario.BOMBERO);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
