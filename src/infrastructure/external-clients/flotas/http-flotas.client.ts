import { Injectable, Logger } from '@nestjs/common';
import {
  IFlotasClientPort,
  OpcionesReservaCamion,
  ReservaCamionResponse,
} from '../../../application/ports/flotas-client.port';
import { EnvConfig } from '../../config/env.config';

@Injectable()
export class HttpFlotasClient implements IFlotasClientPort {
  private readonly logger = new Logger(HttpFlotasClient.name);
  private readonly baseUrl = EnvConfig.ms02FlotasUrl;

  private normalizarTipoFuego(tipo: string): string {
    const t = tipo.toUpperCase();
    if (t.includes('QUIM') || t.includes('HAZMAT')) return 'INDUSTRIAL_QUIMICO';
    if (t.includes('ESTRUCT')) return 'URBANO_ESTRUCTURAL';
    if (t.includes('FOREST')) return 'FORESTAL';
    if (t.includes('VEHIC')) return 'VEHICULAR';
    if (t.includes('ELEC')) return 'ELECTRICO';
    if (t.includes('INDUS')) return 'INDUSTRIAL';
    return 'URBANO_ESTRUCTURAL';
  }

  async reservarCamion(
    incidenteId: string,
    tipoFuego: string,
    opciones?: OpcionesReservaCamion | string,
  ): Promise<ReservaCamionResponse> {
    let camionId = typeof opciones === 'string' ? opciones : opciones?.camionId;
    if (camionId) {
      camionId = camionId.replace(/-SCZ$/i, '');
    }
    const latitud = typeof opciones === 'object' ? opciones.latitud : undefined;
    const longitud = typeof opciones === 'object' ? opciones.longitud : undefined;
    const litrosMinimos = typeof opciones === 'object' ? opciones.litrosMinimos : undefined;

    const payload = {
      incidenteId,
      tipoFuego: this.normalizarTipoFuego(tipoFuego),
      ...(camionId && camionId !== 'AUTO_ASIGNACION' ? { camionId } : {}),
      latitud: latitud ?? -17.7833,
      longitud: longitud ?? -63.1821,
      litrosMinimos: litrosMinimos ?? 3000,
    };

    const urls = [this.baseUrl];
    if (this.baseUrl.includes(':8080')) {
      urls.push(this.baseUrl.replace(':8080', ':8082'));
    } else if (this.baseUrl.includes(':8082')) {
      urls.push(this.baseUrl.replace(':8082', ':8080'));
    }

    let lastError = '';

    for (const targetUrl of urls) {
      try {
        this.logger.log(
          `[TACTICAL-AUDIT MS-02] Conectando a Flotas (Maikol) en: ${targetUrl}/api/v1/flotas/reservar-camion (Payload: ${incidenteId}, ${payload.tipoFuego}, ${camionId || 'AUTO_ASIGNACION'})`,
        );

        const response = await fetch(`${targetUrl}/api/v1/flotas/reservar-camion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const errorMsg = errorBody?.mensaje || `Error HTTP ${response.status} en MS-02 Flotas`;
          this.logger.error(
            `[TACTICAL-AUDIT MS-02 ERROR] Fallo HTTP ${response.status} en ${targetUrl}. Detalle: ${errorMsg}`,
          );
          return {
            exito: false,
            camionId: '',
            tiempoLlegadaMinutos: 0,
            error: errorMsg,
          };
        }

        const data = await response.json();
        const tiempoLlegada = data.tiempoLlegadaMinutos || data.tiempoEstimadoLlegadaMinutos || 5.4;
        const camionReservado = data.camionId || camionId || 'B-04';
        this.logger.log(
          `[TACTICAL-AUDIT MS-02] Respuesta HTTP ${response.status} de Flotas. Camión reservado: ${camionReservado} (Llegada: ${tiempoLlegada} min)`,
        );
        return {
          exito: true,
          camionId: camionReservado,
          reservaId: data.reservaId,
          placa: data.placa,
          tipoUnidad: data.tipoUnidad,
          capacidadAguaLts: data.capacidadAguaLts,
          distanciaKms: data.distanciaKms,
          estacionOrigen: data.estacionOrigen,
          tiempoLlegadaMinutos: tiempoLlegada,
        };
      } catch (err: any) {
        lastError = err.message;
        this.logger.error(
          `[TACTICAL-AUDIT MS-02 ERROR] Fallo HTTP en ${targetUrl}. Detalle: ${err.message}`,
        );
        this.logger.debug(`Intento fallido contra ${targetUrl}: ${err.message}`);
      }
    }

    this.logger.error(
      `[TACTICAL-AUDIT MS-02 ERROR] Fallo de conexión hacia MS-02 Flotas en todas las rutas: ${lastError}`,
    );
    return {
      exito: false,
      camionId: '',
      tiempoLlegadaMinutos: 0,
      error: `Fallo de conexión en red hacia MS-02: ${lastError}`,
    };
  }

  async liberarCamion(
    incidenteId: string,
    camionId: string,
    motivoCompensacion?: string,
  ): Promise<{ exito: boolean; mensaje?: string }> {
    const targetCamionId = camionId ? camionId.replace(/-SCZ$/i, '') : camionId;
    const payload = {
      incidenteId,
      camionId: targetCamionId,
      motivoCompensacion: motivoCompensacion || 'INVENTARIO_RECHAZO_FALTA_STOCK',
    };

    const urls = [this.baseUrl];
    if (this.baseUrl.includes(':8080')) {
      urls.push(this.baseUrl.replace(':8080', ':8082'));
    } else if (this.baseUrl.includes(':8082')) {
      urls.push(this.baseUrl.replace(':8082', ':8080'));
    }

    for (const targetUrl of urls) {
      try {
        this.logger.warn(
          `[TACTICAL-AUDIT SAGA ROLLBACK MS-02] Solicitando liberación de camión en: ${targetUrl}/api/v1/flotas/liberar-camion...`,
        );

        const response = await fetch(`${targetUrl}/api/v1/flotas/liberar-camion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          this.logger.log(
            `[TACTICAL-AUDIT SAGA ROLLBACK MS-02] Camión '${camionId}' liberado con éxito por compensación en ${targetUrl}.`,
          );
          return {
            exito: true,
            mensaje: data.mensaje || 'Unidad liberada con éxito por compensación SAGA.',
          };
        }

        const errorBody = await response.json().catch(() => null);
        const errorMsg = errorBody?.mensaje || `Error HTTP ${response.status} en MS-02 Flotas`;
        this.logger.error(
          `[TACTICAL-AUDIT MS-02 ERROR] Fallo HTTP ${response.status} en ${targetUrl}. Detalle: ${errorMsg}`,
        );
      } catch (err: any) {
        this.logger.error(
          `[TACTICAL-AUDIT MS-02 ERROR] Fallo al compensar en ${targetUrl}. Detalle: ${err.message}`,
        );
        this.logger.warn(`Fallo al compensar en ${targetUrl}: ${err.message}`);
      }
    }

    return { exito: false, mensaje: 'No se pudo contactar a MS-02 para la liberación compensatoria.' };
  }
}
