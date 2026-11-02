import { IncidenteEmergencia } from '../entities/incidente-emergencia.entity';

export interface IIncidenteRepository {
  guardar(incidente: IncidenteEmergencia): Promise<void>;
  buscarPorId(id: string): Promise<IncidenteEmergencia | null>;
  listarActivos(): Promise<IncidenteEmergencia[]>;
  listarTodos(): Promise<IncidenteEmergencia[]>;
}
