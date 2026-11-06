import { ListarOperadoresUseCase } from './listar-operadores.use-case';
import { Usuario } from '../../domain/entities/usuario.entity';
import { RolUsuario } from '../../domain/value-objects/rol-usuario.vo';

describe('ListarOperadoresUseCase', () => {
  let useCase: ListarOperadoresUseCase;
  let mockUsuarioRepo: any;

  const operadores = [
    new Usuario(
      'op-1',
      'Nataly Martínez',
      'nataly.comandos@bomberos.gob.bo',
      'hash1',
      RolUsuario.OPERADOR,
      'Estación Central',
      true,
      undefined,
      new Date().toISOString(),
      '+591 70012345',
    ),
    new Usuario(
      'op-2',
      'Operador Norte',
      'operador.norte@bomberos.gob.bo',
      'hash2',
      RolUsuario.OPERADOR,
      'Estación Norte',
      true,
      undefined,
      new Date().toISOString(),
      '+591 70012346',
    ),
  ];

  beforeEach(() => {
    mockUsuarioRepo = {
      listarOperadoresActivos: jest.fn().mockResolvedValue(operadores),
    };
    useCase = new ListarOperadoresUseCase(mockUsuarioRepo);
  });

  it('debe retornar la lista de operadores activos con sus teléfonos móviles', async () => {
    const resultado = await useCase.execute();

    expect(resultado).toHaveLength(2);
    expect(resultado[0].nombreCompleto).toBe('Nataly Martínez');
    expect(resultado[0].telefonoMovil).toBe('+591 70012345');
    expect(resultado[1].telefonoMovil).toBe('+591 70012346');
    expect(mockUsuarioRepo.listarOperadoresActivos).toHaveBeenCalledTimes(1);
  });
});
