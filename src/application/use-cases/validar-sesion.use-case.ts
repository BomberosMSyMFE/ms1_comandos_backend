import { IUsuarioRepository } from '../../domain/repositories/usuario.repository.interface';
import { ITokenServicePort } from '../ports/token-service.port';
import { CredencialesInvalidasException } from '../../domain/exceptions/credenciales-invalidas.exception';
import { Usuario } from '../../domain/entities/usuario.entity';

export class ValidarSesionUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly tokenService: ITokenServicePort,
  ) {}

  async execute(token: string): Promise<Usuario> {
    try {
      const payload = await this.tokenService.verificarToken(token);
      const usuario = await this.usuarioRepo.buscarPorId(payload.sub);
      if (!usuario || !usuario.activo) {
        throw new CredencialesInvalidasException('Sesión inválida o usuario inactivo.');
      }
      return usuario;
    } catch {
      throw new CredencialesInvalidasException('Token de sesión no válido o expirado.');
    }
  }
}
