import { IDespachoRepository } from '../../domain/repositories/despacho.repository.interface';
import { DespachoTactico } from '../../domain/entities/despacho-tactico.entity';

export class ObtenerDespachosIncidenteUseCase {
  constructor(private readonly despachoRepo: IDespachoRepository) {}

  async execute(incidenteId: string): Promise<DespachoTactico[]> {
    return this.despachoRepo.listarPorIncidente(incidenteId);
  }
}
