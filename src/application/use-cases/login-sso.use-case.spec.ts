import { LoginSsoUseCase } from './login-sso.use-case';
import { Usuario } from '../../domain/entities/usuario.entity';
import { RolUsuario } from '../../domain/value-objects/rol-usuario.vo';
import { CredencialesInvalidasException } from '../../domain/exceptions/credenciales-invalidas.exception';

describe('LoginSsoUseCase (Single Sign-On)', () => {
  let useCase: LoginSsoUseCase;
  let mockUsuarioRepo: any;
  let mockTokenService: any;
  let mockPasswordHasher: any;

  const usuarioActivo = new Usuario(
    'usr-1',
    'Nataly Martínez',
    'nataly.comandos@bomberos.gob.bo',
    '$2a$12$hashedPassword',
    RolUsuario.OPERADOR,
    'Estación Central',
    true,
    undefined,
    undefined,
    '+591 70012345',
  );

  beforeEach(() => {
    mockUsuarioRepo = {
      buscarPorEmail: jest.fn().mockResolvedValue(usuarioActivo),
      guardar: jest.fn().mockResolvedValue(undefined),
    };

    mockTokenService = {
      generarToken: jest.fn().mockResolvedValue('jwt.fake.token'),
    };

    mockPasswordHasher = {
      compare: jest.fn().mockResolvedValue(true),
    };

    useCase = new LoginSsoUseCase(mockUsuarioRepo, mockTokenService, mockPasswordHasher);
  });

  it('debe autenticar exitosamente y retornar token JWT con datos del usuario', async () => {
    const result = await useCase.execute({
      email: 'nataly.comandos@bomberos.gob.bo',
      password: 'Comandos2026!',
    });

    expect(result.token).toBe('jwt.fake.token');
    expect(result.usuario.email).toBe('nataly.comandos@bomberos.gob.bo');
    expect(result.usuario.rol).toBe(RolUsuario.OPERADOR);
    expect(result.usuario.telefonoMovil).toBe('+591 70012345');
    expect(mockUsuarioRepo.guardar).toHaveBeenCalled(); // Guarda el último login
  });

  it('debe lanzar CredencialesInvalidasException si la contraseña no coincide', async () => {
    mockPasswordHasher.compare.mockResolvedValueOnce(false);

    await expect(
      useCase.execute({
        email: 'nataly.comandos@bomberos.gob.bo',
        password: 'PasswordIncorrecto',
      }),
    ).rejects.toThrow(CredencialesInvalidasException);
  });

  it('debe lanzar CredencialesInvalidasException si el usuario no existe', async () => {
    mockUsuarioRepo.buscarPorEmail.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        email: 'noexiste@bomberos.gob.bo',
        password: 'password',
      }),
    ).rejects.toThrow(CredencialesInvalidasException);
  });
});
