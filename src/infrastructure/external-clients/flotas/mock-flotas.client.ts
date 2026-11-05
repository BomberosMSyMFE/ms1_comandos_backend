import { Injectable, Logger } from '@nestjs/common';
import {
  IFlotasClientPort,
  OpcionesReservaCamion,
  ReservaCamionResponse,
} from '../../../application/ports/flotas-client.port';

@Injectable()
export class MockFlotasClient implements IFlotasClientPort {
  private readonly logger = new Logger(MockFlotasClient.name);

  async reservarCamion(
    incidenteId: string,
    tipoFuego: string,
    opciones?: OpcionesReservaCamion | string,
  ): Promise<ReservaCamionResponse> {
    const camionId = typeof opciones === 'string' ? opciones : opciones?.camionId;
    this.logger.log(
      `[MOCK MS-02 FLOTAS] Solicitando reserva para incidente '${incidenteId}', tipo '${tipoFuego}', camión '${camionId || 'AUTO'}'.`,
    );

    // Simulación de error forzado si se solicita un camión específico de prueba 'CAM-SIN-STOCK'
    if (camionId === 'CAM-SIN-STOCK') {
      return {
        exito: false,
        camionId: '',
        tiempoLlegadaMinutos: 0,
        error: 'Unidad CAM-SIN-STOCK fuera de servicio por mantenimiento.',
      };
    }

    const unidadAsignada = camionId || 'B-04';
    return {
      exito: true,
      camionId: unidadAsignada,
      reservaId: 'RES-MOCK-9912',
      placa: '3482-LKP',
      tipoUnidad: 'CISTERNA_PESADA',
      capacidadAguaLts: 10000,
      tiempoLlegadaMinutos: 5.4,
      distanciaKms: 3.2,
      estacionOrigen: 'Estación Norte - Pampa de la Isla',
    };
  }

  async liberarCamion(
    incidenteId: string,
    camionId: string,
    motivoCompensacion?: string,
  ): Promise<{ exito: boolean; mensaje?: string }> {
    this.logger.warn(
      `[MOCK MS-02 FLOTAS] Acción Compensatoria SAGA: Liberando camión '${camionId}' del incidente '${incidenteId}' (Motivo: ${motivoCompensacion || 'COMPENSACION_SAGA'}).`,
    );
    return { exito: true, mensaje: 'Reserva revertida exitosamente en mock.' };
  }
}
