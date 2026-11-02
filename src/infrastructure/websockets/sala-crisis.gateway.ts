import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { IEventNotifierPort } from '../../application/ports/event-notifier.port';

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

  private readonly logger = new Logger(SalaCrisisGateway.name);

  afterInit() {
    this.logger.log('Gateway de WebSockets inicializado en namespace /ws/sala-crisis.');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado a la Sala de Crisis: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado de la Sala de Crisis: ${client.id}`);
  }

  async notificarIncidenteCreado(incidente: any): Promise<void> {
    this.logger.log(`[WebSocket] Emitiendo INCIDENTE_CREADO: ${incidente.id}`);
    this.server?.emit('INCIDENTE_CREADO', incidente);
  }

  async notificarIncidenteDespachado(datos: any): Promise<void> {
    this.logger.log(`[WebSocket] Emitiendo INCIDENTE_DESPACHADO para unidad: ${datos.camionAsignado}`);
    this.server?.emit('INCIDENTE_DESPACHADO', datos);
  }

  async notificarCambioEstado(incidenteId: string, estado: string, historial: any): Promise<void> {
    this.logger.log(`[WebSocket] Emitiendo ESTADO_CAMBIADO: ${incidenteId} -> ${estado}`);
    this.server?.emit('ESTADO_CAMBIADO', { incidenteId, estado, historial });
  }

  async notificarAlerta(alerta: any): Promise<void> {
    this.logger.warn(`[WebSocket] Emitiendo ALERTA_CRISIS: ${alerta.tipo}`);
    this.server?.emit('ALERTA_CRISIS', alerta);
  }
}
