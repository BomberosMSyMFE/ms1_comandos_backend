import { IHistorialRepository } from '../../domain/repositories/historial.repository.interface';
import { HistorialIncidente } from '../../domain/entities/historial-incidente.entity';

export class ObtenerTimelineIncidenteUseCase {
  constructor(private readonly historialRepo: IHistorialRepository) {}

  async execute(incidenteId: string): Promise<HistorialIncidente[]> {
    return this.historialRepo.obtenerTimelinePorIncidente(incidenteId);
  }
}
