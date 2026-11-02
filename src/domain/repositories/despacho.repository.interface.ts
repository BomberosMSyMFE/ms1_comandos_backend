import { DespachoTactico } from '../entities/despacho-tactico.entity';

export interface IDespachoRepository {
  guardar(despacho: DespachoTactico): Promise<void>;
  buscarPorId(despachoId: string): Promise<DespachoTactico | null>;
  listarPorIncidente(incidenteId: string): Promise<DespachoTactico[]>;
}
