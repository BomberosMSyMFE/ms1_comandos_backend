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

    // 1. Resolver dirección y ubicación geográfica táctica
    let direccionFinal =
      dto.ubicacion ||
      dto.direccion ||
      dto.direccionReportada ||
      dto.referencia ||
      dto.zona ||
      dto.distrito ||
      dto.barrio ||
      dto.lugar;

    // Si viene la etiqueta genérica 'Zona reportada por ciudadano', revisar si contiene texto real adicional
    if (direccionFinal && direccionFinal.includes('Zona reportada por ciudadano')) {
      const limpio = direccionFinal
        .replace(/Zona reportada por ciudadano/gi, '')
        .replace(/\(Ticket\s+RAD-[A-Za-z0-9]+\)/gi, '')
        .replace(/\[Ticket\s+RAD-[A-Za-z0-9]+\]/gi, '')
        .replace(/^[\s\-:,]+/, '')
        .trim();
      if (limpio.length > 2) {
        const matchTicket = (dto.descripcion || direccionFinal).match(/RAD-[A-Za-z0-9]+/);
        const ticketTag = matchTicket ? ` [Ticket ${matchTicket[0]}]` : '';
        direccionFinal = `${limpio}${ticketTag}`;
      } else {
        direccionFinal = '';
      }
    }

    // Si la dirección sigue vacía, derivar referencia táctica enriquecida por GPS (lat, lng)
    if (!direccionFinal || direccionFinal.trim() === '') {
      const geoRef = this.obtenerReferenciaTacticoGps(dto.latitud, dto.longitud);
      const matchTicket = (dto.descripcion || '').match(/RAD-[A-Za-z0-9]+/);
      const ticketTag = matchTicket ? ` [Ticket ${matchTicket[0]}]` : '';
      direccionFinal = `${geoRef}${ticketTag}`;
    }

    // 2. Resolver cuadrante operativo
    let zonaCuadranteFinal =
      dto.zonaCuadrante || dto.cuadrante || this.calcularCuadranteGps(dto.latitud, dto.longitud);

    // Ajuste táctico si la dirección indica explícitamente Villa 1ro de Mayo / Este
    if (
      direccionFinal &&
      (direccionFinal.toLowerCase().includes('1ero de mayo') ||
        direccionFinal.toLowerCase().includes('primero de mayo') ||
        direccionFinal.toLowerCase().includes('villa 1ro'))
    ) {
      zonaCuadranteFinal = 'Cuadrante Este';
    }

    const coordenada = new CoordenadaGPS(
      dto.latitud,
      dto.longitud,
      direccionFinal,
      zonaCuadranteFinal,
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

  private obtenerReferenciaTacticoGps(lat: number, lng: number): string {
    if (lat > -17.75 && lat < -17.73) return 'Zona Norte / Satélite Norte (G-77)';
    if (lat <= -17.75 && lat >= -17.775) {
      if (lng <= -63.19) return 'Equipetrol Norte / Av. San Martín 4to Anillo';
      if (lng > -63.19 && lng <= -63.165) return 'Av. Cristo Redentor y Mutualista 3er Anillo';
      return 'Parque Industrial PI-27 / Mutualista';
    }
    if (lat < -17.775 && lat >= -17.795) {
      if (lng <= -63.195) return 'Radial 19 y Costanera Río Piraí';
      if (lng > -63.195 && lng <= -63.17) return 'Casco Viejo / Centro Histórico (Plaza 24 de Septiembre)';
      if (lng > -63.17 && lng <= -63.14) return 'Villa 1ro de Mayo / Tres Pasos al Frente';
      return 'Radial 10 y Av. Cumavi';
    }
    if (lat < -17.795) {
      if (lng <= -63.19) return 'Doble Vía a La Guardia y 6to Anillo';
      if (lng > -63.19 && lng <= -63.17) return 'Av. Santos Dumont y 5to Anillo';
      if (lng > -63.17 && lng <= -63.14) return 'Villa 1ro de Mayo / Plaza Principal';
      return 'Ciudadela Plan 3000 / El Mechero';
    }
    return 'Radio Urbano Central, Santa Cruz de la Sierra';
  }

  private calcularCuadranteGps(lat: number, lng: number): string {
    if (lat > -17.77) return 'Cuadrante Norte';
    if (lat < -17.795) return 'Cuadrante Sur';
    if (lng > -63.17) return 'Cuadrante Este';
    if (lng < -63.195) return 'Cuadrante Oeste';
    return 'Cuadrante Central';
  }
}
