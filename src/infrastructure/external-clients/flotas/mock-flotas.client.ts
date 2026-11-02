import { Injectable, Logger } from '@nestjs/common';
import { IFlotasClientPort, ReservaCamionResponse } from '../../../application/ports/flotas-client.port';

@Injectable()
export class MockFlotasClient implements IFlotasClientPort {
  private readonly logger = new Logger(MockFlotasClient.name);

  async reservarCamion(
    incidenteId: string,
    tipoFuego: string,
    camionId?: string,
  ): Promise<ReservaCamionResponse> {
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

    const unidadAsignada = camionId || 'CAM-B04';
    return {
      exito: true,
      camionId: unidadAsignada,
      tiempoLlegadaMinutos: 6.5,
    };
  }

  async liberarCamion(incidenteId: string, camionId: string): Promise<{ exito: boolean }> {
    this.logger.warn(
      `[MOCK MS-02 FLOTAS] Acción Compensatoria SAGA: Liberando camión '${camionId}' del incidente '${incidenteId}'.`,
    );
    return { exito: true };
  }
}
