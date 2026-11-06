import { IUsuarioRepository } from '../../domain/repositories/usuario.repository.interface';
import { ITokenServicePort } from '../ports/token-service.port';
import { IPasswordHasherPort } from '../ports/password-hasher.port';
import { IAppLoggerPort } from '../ports/logger.port';
import { LoginRequestDto } from '../dtos/auth/login-request.dto';
import { LoginResponseDto } from '../dtos/auth/login-response.dto';
import { CredencialesInvalidasException } from '../../domain/exceptions/credenciales-invalidas.exception';

export class LoginSsoUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly tokenService: ITokenServicePort,
    private readonly passwordHasher: IPasswordHasherPort,
    private readonly logger?: IAppLoggerPort,
  ) {}

  async execute(dto: LoginRequestDto): Promise<LoginResponseDto> {
    this.logger?.log(
      'SSO-AUTH',
      `Intento de autenticación recibido para email: ${dto.email}`,
      { email: dto.email },
    );

    const usuario = await this.usuarioRepo.buscarPorEmail(dto.email);
    if (!usuario) {
      this.logger?.warn(
        'SSO-AUTH',
        `Autenticación fallida: Correo '${dto.email}' no registrado en el sistema.`,
        { email: dto.email },
      );
      throw new CredencialesInvalidasException('Correo o contraseña incorrectos.');
    }

    if (!usuario.activo) {
      this.logger?.warn(
        'SSO-AUTH',
        `Autenticación fallida: Cuenta inactiva para usuario '${usuario.id}' (${dto.email}).`,
        { email: dto.email, usuarioId: usuario.id },
      );
      throw new CredencialesInvalidasException('La cuenta de usuario está inactiva. Contacte al administrador.');
    }

    const passwordValido = await this.passwordHasher.compare(dto.password, usuario.passwordHash);
    if (!passwordValido) {
      this.logger?.warn(
        'SSO-AUTH',
        `Autenticación fallida: Contraseña inválida para correo '${dto.email}'.`,
        { email: dto.email, usuarioId: usuario.id },
      );
      throw new CredencialesInvalidasException('Correo o contraseña incorrectos.');
    }

    usuario.actualizarUltimoLogin();
    await this.usuarioRepo.guardar(usuario);

    const token = await this.tokenService.generarToken({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    });

    this.logger?.log(
      'SSO-AUTH',
      `Autenticación exitosa | Usuario: ${usuario.id} | Email: ${usuario.email} | Rol: ${usuario.rol} | Sesión SSO activa.`,
      { usuarioId: usuario.id, email: usuario.email, rol: usuario.rol },
    );

    return {
      mensaje: 'Autenticación exitosa. Sesión SSO iniciada.',
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        email: usuario.email,
        rol: usuario.rol,
        estacionBase: usuario.estacionBase,
        telefonoMovil: usuario.telefonoMovil,
      },
      token,
    };
  }
}
