import { Usuario } from '../entities/usuario.entity';

export interface IUsuarioRepository {
  guardar(usuario: Usuario): Promise<void>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  listarOperadoresActivos(): Promise<Usuario[]>;
  listarTodos(): Promise<Usuario[]>;
}

