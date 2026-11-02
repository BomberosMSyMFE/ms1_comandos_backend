import { HistorialIncidente } from '../entities/historial-incidente.entity';

export interface IHistorialRepository {
  guardar(historial: HistorialIncidente): Promise<void>;
  obtenerTimelinePorIncidente(incidenteId: string): Promise<HistorialIncidente[]>;
}
