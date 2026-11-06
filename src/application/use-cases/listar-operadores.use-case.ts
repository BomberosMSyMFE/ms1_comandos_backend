import { IUsuarioRepository } from '../../domain/repositories/usuario.repository.interface';
import { Usuario } from '../../domain/entities/usuario.entity';

export class ListarOperadoresUseCase {
  constructor(private readonly usuarioRepo: IUsuarioRepository) {}

  async execute(): Promise<Usuario[]> {
    return this.usuarioRepo.listarOperadoresActivos();
  }
}
