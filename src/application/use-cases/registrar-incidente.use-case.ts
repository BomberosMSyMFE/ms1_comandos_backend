import { v7 as uuidv7 } from 'uuid';
import { IIncidenteRepository } from '../../domain/repositories/incidente.repository.interface';
import { IHistorialRepository } from '../../domain/repositories/historial.repository.interface';
import { IEventNotifierPort } from '../ports/event-notifier.port';
import { CrearIncidenteDto } from '../dtos/incidente/crear-incidente.dto';
import { IncidenteEmergencia } from '../../domain/entities/incidente-emergencia.entity';
import { CoordenadaGPS } from '../../domain/value-objects/coordenada-gps.vo';
import { EstadoIncidente } from '../../domain/value-objects/estado-incidente.vo';
import { HistorialIncidente } from '../../domain/entities/historial-incidente.entity';

export class RegistrarIncidenteUseCase {
  constructor(
    private readonly incidenteRepo: IIncidenteRepository,
    private readonly historialRepo: IHistorialRepository,
    private readonly eventNotifier: IEventNotifierPort,
  ) {}

  async execute(dto: CrearIncidenteDto, operadorId: string): Promise<IncidenteEmergencia> {
    const id = uuidv7();
    const codigoSecuencial = Math.floor(100 + Math.random() * 900);
    const codigoRadial = `INC-2026-SCZ-${codigoSecuencial}`;

    const coordenada = new CoordenadaGPS(
      dto.latitud,
      dto.longitud,
      dto.direccion,
      dto.zonaCuadrante,
    );

    const denunciante = dto.denuncianteNombre
      ? { nombre: dto.denuncianteNombre, telefono: dto.denuncianteTelefono || '' }
      : undefined;

    const incidente = new IncidenteEmergencia(
      id,
      codigoRadial,
      dto.tipoIncidente,
      dto.severidad,
      dto.descripcion,
      coordenada,
      operadorId,
      EstadoIncidente.PENDIENTE,
      0,
      denunciante,
    );

    await this.incidenteRepo.guardar(incidente);

    const historial = HistorialIncidente.registrar(
      id,
      EstadoIncidente.PENDIENTE,
      operadorId,
      `Alarma registrada: ${dto.tipoIncidente} (${dto.severidad}) en ${dto.direccion || 'ubicación GPS'}.`,
    );
    await this.historialRepo.guardar(historial);

    await this.eventNotifier.notificarIncidenteCreado(incidente);

    return incidente;
  }
}
