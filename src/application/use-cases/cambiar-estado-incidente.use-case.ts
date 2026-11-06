import { IIncidenteRepository } from '../../domain/repositories/incidente.repository.interface';
import { IHistorialRepository } from '../../domain/repositories/historial.repository.interface';
import { IEventNotifierPort } from '../ports/event-notifier.port';
import { CambiarEstadoIncidenteDto } from '../dtos/incidente/cambiar-estado.dto';
import { IncidenteEmergencia } from '../../domain/entities/incidente-emergencia.entity';
import { IncidenteNoEncontradoException } from '../../domain/exceptions/incidente-no-encontrado.exception';
import { EstadoIncidente } from '../../domain/value-objects/estado-incidente.vo';
import { HistorialIncidente } from '../../domain/entities/historial-incidente.entity';

export class CambiarEstadoIncidenteUseCase {
  constructor(
    private readonly incidenteRepo: IIncidenteRepository,
    private readonly historialRepo: IHistorialRepository,
    private readonly eventNotifier: IEventNotifierPort,
  ) {}

  async execute(
    incidenteId: string,
    dto: CambiarEstadoIncidenteDto,
    operadorId: string,
  ): Promise<IncidenteEmergencia> {
    const incidente = await this.incidenteRepo.buscarPorId(incidenteId);
    if (!incidente) {
      throw new IncidenteNoEncontradoException(incidenteId);
    }

    const estadoAnterior = incidente.estado;

    switch (dto.nuevoEstado) {
      case EstadoIncidente.EN_COMBATE:
        incidente.marcarEnCombate();
        break;
      case EstadoIncidente.CONTROLADO:
        incidente.controlar();
        break;
      case EstadoIncidente.LIQUIDADO:
        incidente.liquidar();
        break;
      case EstadoIncidente.CERRADO:
        incidente.cerrar();
        break;
      default:
        break;
    }

    await this.incidenteRepo.guardar(incidente);

    const historial = HistorialIncidente.registrar(
      incidenteId,
      incidente.estado,
      operadorId,
      dto.novedadTexto,
      estadoAnterior,
      dto.nivelAguaActual,
    );
    await this.historialRepo.guardar(historial);

    await this.eventNotifier.notificarCambioEstado(incidenteId, incidente.estado, historial);

    return incidente;
  }
}
