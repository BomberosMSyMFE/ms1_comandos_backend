import { IIncidenteRepository } from '../../domain/repositories/incidente.repository.interface';
import { IncidenteEmergencia } from '../../domain/entities/incidente-emergencia.entity';

export class ListarIncidentesActivosUseCase {
  constructor(private readonly incidenteRepo: IIncidenteRepository) {}

  async execute(): Promise<IncidenteEmergencia[]> {
    return this.incidenteRepo.listarActivos();
  }
}
