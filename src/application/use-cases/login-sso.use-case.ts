import { IUsuarioRepository } from '../../domain/repositories/usuario.repository.interface';
import { ITokenServicePort } from '../ports/token-service.port';
import { IPasswordHasherPort } from '../ports/password-hasher.port';
import { LoginRequestDto } from '../dtos/auth/login-request.dto';
import { LoginResponseDto } from '../dtos/auth/login-response.dto';
import { CredencialesInvalidasException } from '../../domain/exceptions/credenciales-invalidas.exception';

export class LoginSsoUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly tokenService: ITokenServicePort,
    private readonly passwordHasher: IPasswordHasherPort,
  ) {}

  async execute(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const usuario = await this.usuarioRepo.buscarPorEmail(dto.email);
    if (!usuario) {
      throw new CredencialesInvalidasException('Correo o contraseña incorrectos.');
    }

    if (!usuario.activo) {
      throw new CredencialesInvalidasException('La cuenta de usuario está inactiva. Contacte al administrador.');
    }

    const passwordValido = await this.passwordHasher.compare(dto.password, usuario.passwordHash);
    if (!passwordValido) {
      throw new CredencialesInvalidasException('Correo o contraseña incorrectos.');
    }

    usuario.actualizarUltimoLogin();
    await this.usuarioRepo.guardar(usuario);

    const token = await this.tokenService.generarToken({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    });

    return {
      mensaje: 'Autenticación exitosa. Sesión SSO iniciada.',
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        email: usuario.email,
        rol: usuario.rol,
        estacionBase: usuario.estacionBase,
      },
      token,
    };
  }
}
