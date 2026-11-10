import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { IEventNotifierPort } from '../../application/ports/event-notifier.port';
import { TacticalLoggerService } from '../logging/tactical-logger.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/ws/sala-crisis',
})
export class SalaCrisisGateway
  implements IEventNotifierPort, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly logger: TacticalLoggerService) {}

  afterInit() {
    this.logger.log(
      'SALA-CRISIS-WS',
      '⚡ Gateway de WebSockets inicializado en namespace /ws/sala-crisis (Socket.io listo para eventos tácticos).',
    );
  }

  handleConnection(client: Socket) {
    const address = client.handshake.address || 'desconocida';
    this.logger.log(
      'SALA-CRISIS-WS',
      `[CONEXION] Terminal de Sala de Crisis conectada | SocketId: ${client.id} | IP: ${address}`,
      { socketId: client.id, ip: address },
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      'SALA-CRISIS-WS',
      `[DESCONEXION] Terminal de Sala de Crisis desconectada | SocketId: ${client.id}`,
      { socketId: client.id },
    );
  }

  async notificarIncidenteCreado(incidente: any): Promise<void> {
    const codigo = incidente.codigoRadial || incidente.codigo || incidente.id;
    const ubicacionObj = typeof incidente.ubicacion?.toJSON === 'function' ? incidente.ubicacion.toJSON() : (incidente.ubicacion || {});
    const sev = incidente.severidad || 'MEDIA';
    const nivelRiesgo = sev === 'CRITICA' || sev === 'ALTA' ? 'CRITICO' : sev === 'MEDIA' ? 'ALERTA' : 'CONTROLADO';

    const payloadWs = {
      id: incidente.id,
      codigoRadial: codigo,
      codigo: codigo,
      tipoIncidente: incidente.tipoIncidente,
      tipo: incidente.tipoIncidente,
      severidad: sev,
      nivelRiesgo,
      descripcion: incidente.descripcion,
      titulo: incidente.descripcion ? (incidente.descripcion.length > 50 ? incidente.descripcion.slice(0, 50) + '...' : incidente.descripcion) : `Siniestro ${codigo}`,
      estado: incidente.estado || 'PENDIENTE',
      ubicacion: ubicacionObj,
      direccion: ubicacionObj.dir || incidente.ubicacion?.direccion || incidente.direccion || '',
      cuadrante: ubicacionObj.zona_cuadrante || incidente.ubicacion?.zonaCuadrante || incidente.cuadrante || 'Cuadrante Central',
      latitud: ubicacionObj.lat ?? incidente.ubicacion?.latitud ?? -17.7833,
      longitud: ubicacionObj.lng ?? incidente.ubicacion?.longitud ?? -63.1821,
      unidadesAsignadas: incidente.unidadesAsignadas || 0,
      camionAsignado: incidente.camionAsignado || null,
      operadorId: incidente.operadorId,
      denunciante: incidente.denunciante,
      createdAt: incidente.createdAt || new Date().toISOString(),
      updatedAt: incidente.updatedAt || new Date().toISOString(),
    };

    this.logger.log(
      'SALA-CRISIS-WS',
      `[EMIT:INCIDENTE_CREADO] Alarma emitida a Sala de Crisis | Código: ${codigo} | Tipo: ${payloadWs.tipoIncidente} (${payloadWs.severidad})`,
      { incidenteId: payloadWs.id, codigoRadial: codigo, tipo: payloadWs.tipoIncidente },
    );
    this.server?.emit('INCIDENTE_CREADO', payloadWs);
  }

  async notificarIncidenteDespachado(datos: any): Promise<void> {
    this.logger.log(
      'SALA-CRISIS-WS',
      `[EMIT:INCIDENTE_DESPACHADO] Despacho emitido a Sala de Crisis | Incidente: ${datos.incidenteId} | Unidad: ${datos.camionAsignado} | ETA: ${datos.tiempoEstimadoArriboMinutos} min`,
      { incidenteId: datos.incidenteId, camion: datos.camionAsignado, eta: datos.tiempoEstimadoArriboMinutos },
    );
    this.server?.emit('INCIDENTE_DESPACHADO', datos);
  }

  async notificarCambioEstado(incidenteId: string, estado: string, historial: any): Promise<void> {
    const codRadial = historial?.codigoRadial || incidenteId;
    this.logger.log(
      'SALA-CRISIS-WS',
      `[EMIT:ESTADO_CAMBIADO] Transición de siniestro emitida | Incidente: ${codRadial} (${incidenteId}) -> ${estado}`,
      { incidenteId, codigoRadial: codRadial, estado, operador: historial?.operadorId },
    );
    const payload = {
      incidenteId,
      codigoRadial: codRadial,
      codigo: codRadial,
      estado,
      historial,
    };
    this.server?.emit('ESTADO_CAMBIADO', payload);
    this.server?.emit('INCIDENTE_CAMBIADO', payload);
  }

  async notificarAlerta(alerta: any): Promise<void> {
    const tipo = alerta.tipo || 'GENERAL';
    this.logger.warn(
      'SALA-CRISIS-WS',
      `[EMIT:ALERTA_CRISIS] [ALERTA] Alerta crítica emitida a Sala de Crisis | Tipo: ${tipo}`,
      { tipo, alerta },
    );
    this.server?.emit('ALERTA_CRISIS', alerta);
  }
}
