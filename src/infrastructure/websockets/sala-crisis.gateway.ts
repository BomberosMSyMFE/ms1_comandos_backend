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
    const codigo = incidente.codigoRadial || incidente.id;
    this.logger.log(
      'SALA-CRISIS-WS',
      `[EMIT:INCIDENTE_CREADO] Alarma emitida a Sala de Crisis | Código: ${codigo} | Tipo: ${incidente.tipoIncidente} (${incidente.severidad})`,
      { incidenteId: incidente.id, codigoRadial: codigo, tipo: incidente.tipoIncidente },
    );
    this.server?.emit('INCIDENTE_CREADO', incidente);
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
    this.logger.log(
      'SALA-CRISIS-WS',
      `[EMIT:ESTADO_CAMBIADO] Transición de siniestro emitida | Incidente: ${incidenteId} -> ${estado}`,
      { incidenteId, estado, operador: historial?.operadorId },
    );
    this.server?.emit('ESTADO_CAMBIADO', { incidenteId, estado, historial });
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
