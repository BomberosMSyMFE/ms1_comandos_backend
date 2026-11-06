import { Usuario } from './usuario.entity';
import { RolUsuario } from '../value-objects/rol-usuario.vo';

describe('Usuario Entity (Atributo Teléfono Móvil y Gestión)', () => {
  it('debe instanciar correctamente un usuario con teléfono móvil', () => {
    const usuario = new Usuario(
      'usr-1',
      'Nataly Martínez',
      'nataly.comandos@bomberos.gob.bo',
      'hashed_pwd',
      RolUsuario.OPERADOR,
      'Estación Central - Santa Cruz',
      true,
      undefined,
      new Date().toISOString(),
      '+591 70012345',
    );

    expect(usuario.id).toBe('usr-1');
    expect(usuario.nombreCompleto).toBe('Nataly Martínez');
    expect(usuario.email).toBe('nataly.comandos@bomberos.gob.bo');
    expect(usuario.rol).toBe(RolUsuario.OPERADOR);
    expect(usuario.estacionBase).toBe('Estación Central - Santa Cruz');
    expect(usuario.telefonoMovil).toBe('+591 70012345');
    expect(usuario.activo).toBe(true);
  });

  it('debe permitir actualizar el teléfono móvil del usuario', () => {
    const usuario = new Usuario(
      'usr-2',
      'Operador Norte',
      'operador.norte@bomberos.gob.bo',
      'hashed_pwd',
      RolUsuario.OPERADOR,
      'Estación Norte',
      true,
    );

    expect(usuario.telefonoMovil).toBe('');
    usuario.actualizarTelefonoMovil('+591 70012346');
    expect(usuario.telefonoMovil).toBe('+591 70012346');
  });

  it('debe permitir activar y desactivar al usuario', () => {
    const usuario = new Usuario(
      'usr-3',
      'Bombero Inactivo',
      'bombero@bomberos.gob.bo',
      'hashed_pwd',
      RolUsuario.BOMBERO,
      'Estación Sur',
      true,
    );

    usuario.desactivar();
    expect(usuario.activo).toBe(false);

    usuario.activar();
    expect(usuario.activo).toBe(true);
  });
});
