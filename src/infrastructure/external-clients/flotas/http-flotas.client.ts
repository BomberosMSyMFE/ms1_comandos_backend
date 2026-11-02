import { Injectable, Logger } from '@nestjs/common';
import { IFlotasClientPort, ReservaCamionResponse } from '../../../application/ports/flotas-client.port';
import { EnvConfig } from '../../config/env.config';

@Injectable()
export class HttpFlotasClient implements IFlotasClientPort {
  private readonly logger = new Logger(HttpFlotasClient.name);
  private readonly baseUrl = EnvConfig.ms02FlotasUrl;

  async reservarCamion(
    incidenteId: string,
    tipoFuego: string,
    camionId?: string,
  ): Promise<ReservaCamionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/flotas/reservar-camion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidenteId, tipoFuego, camionId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          exito: false,
          camionId: '',
          tiempoLlegadaMinutos: 0,
          error: `Error HTTP ${response.status} en MS-02 Flotas: ${errorText}`,
        };
      }

      const data = await response.json();
      return {
        exito: true,
        camionId: data.camionId || camionId || 'CAM-B04',
        tiempoLlegadaMinutos: data.tiempoLlegadaMinutos || 7.0,
      };
    } catch (err: any) {
      this.logger.error(`Fallo de conexión hacia MS-02 Flotas: ${err.message}`);
      return {
        exito: false,
        camionId: '',
        tiempoLlegadaMinutos: 0,
        error: `Fallo de conexión en red hacia MS-02: ${err.message}`,
      };
    }
  }

  async liberarCamion(incidenteId: string, camionId: string): Promise<{ exito: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/flotas/liberar-camion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidenteId, camionId }),
      });
      return { exito: response.ok };
    } catch (err: any) {
      this.logger.error(`Fallo al solicitar liberación de camión en MS-02: ${err.message}`);
      return { exito: false };
    }
  }
}
