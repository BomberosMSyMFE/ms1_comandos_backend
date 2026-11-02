import { ReporteEjecutivo } from '../entities/reporte-ejecutivo.entity';

export interface IReporteRepository {
  guardar(reporte: ReporteEjecutivo): Promise<void>;
  buscarPorId(id: string): Promise<ReporteEjecutivo | null>;
  listarPorComandante(comandanteId: string): Promise<ReporteEjecutivo[]>;
  listarTodos(): Promise<ReporteEjecutivo[]>;
}
