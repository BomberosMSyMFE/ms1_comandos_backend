import { Injectable, Logger } from '@nestjs/common';
import {
  IInventarioClientPort,
  InsumoReservaItem,
  ReservaInsumosResponse,
} from '../../../application/ports/inventario-client.port';
import { EnvConfig } from '../../config/env.config';

@Injectable()
export class GraphqlInventarioClient implements IInventarioClientPort {
  private readonly logger = new Logger(GraphqlInventarioClient.name);
  private readonly graphqlUrl = EnvConfig.ms03InventarioUrl;

  async reservarInsumos(
    incidenteId: string,
    camionId: string,
    insumos?: InsumoReservaItem[],
    litrosEspumogeno?: number,
  ): Promise<ReservaInsumosResponse> {
    const mutation = `
      mutation ReservarKitParaDespacho(
        $incidenteId: ID!
        $camionId: String!
        $litrosEspumogeno: Float!
      ) {
        reservarKitParaDespacho(
          incidenteId: $incidenteId
          camionId: $camionId
          litrosEspumogeno: $litrosEspumogeno
        ) {
          exito
          transaccionId
          materialesReservados
          mensaje
          codigoError
        }
      }
    `;

    try {
      this.logger.log(
        `[TACTICAL-AUDIT MS-03] Conectando a Inventario GraphQL (Jael) en: ${this.graphqlUrl} (Mutación: reservarInsumos)`,
      );
      this.logger.log(
        `[GraphQL MS-03] Ejecutando mutation reservarKitParaDespacho para incidente '${incidenteId}', camión '${camionId}'.`,
      );

      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: {
            incidenteId,
            camionId,
            litrosEspumogeno: litrosEspumogeno || 250.0,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Error de respuesta HTTP');
        this.logger.error(
          `[TACTICAL-AUDIT MS-03 ERROR] Fallo en servicio de Inventario GraphQL en ${this.graphqlUrl}. Errores: HTTP ${response.status} - ${errorText}`,
        );
        return {
          exito: false,
          error: `HTTP ${response.status} en Inventario MS-03: ${errorText}`,
        };
      }

      const body = await response.json();
      if (body.errors && body.errors.length > 0) {
        const erroresMsg = body.errors.map((e: any) => e.message).join(' | ');
        this.logger.error(
          `[TACTICAL-AUDIT MS-03 ERROR] Fallo en servicio de Inventario GraphQL en ${this.graphqlUrl}. Errores: ${erroresMsg}`,
        );
        this.logger.warn(`[GraphQL MS-03] Error en respuesta: ${body.errors[0].message}`);
        return {
          exito: false,
          error: body.errors[0].message || 'Error en GraphQL MS-03 Inventario',
        };
      }

      const resData = body.data?.reservarKitParaDespacho;
      if (!resData?.exito) {
        const errorMsg = resData?.mensaje || resData?.codigoError || 'Error desconocido en reserva de insumos';
        this.logger.error(
          `[TACTICAL-AUDIT MS-03 ERROR] Fallo en servicio de Inventario GraphQL en ${this.graphqlUrl}. Errores: ${errorMsg}`,
        );
      } else {
        this.logger.log(
          `[TACTICAL-AUDIT MS-03] Respuesta exitosa de Inventario GraphQL. Reserva confirmada.`,
        );
      }

      const materialesStr = Array.isArray(resData?.materialesReservados)
        ? resData.materialesReservados.join(', ')
        : (resData?.materialesReservados || undefined);
      return {
        exito: resData?.exito || false,
        transaccionId: resData?.transaccionId,
        materialesReservados: materialesStr,
        error: resData?.exito ? undefined : (resData?.mensaje || resData?.codigoError),
      };
    } catch (err: any) {
      this.logger.error(
        `[TACTICAL-AUDIT MS-03 ERROR] Fallo en servicio de Inventario GraphQL en ${this.graphqlUrl}. Errores: ${err.message}`,
      );
      this.logger.error(`Fallo de conexión hacia GraphQL MS-03 Inventario: ${err.message}`);
      return {
        exito: false,
        error: `Fallo de conexión en red hacia MS-03: ${err.message}`,
      };
    }
  }

  async liberarInsumos(transaccionId: string, incidenteId?: string): Promise<{ exito: boolean; mensaje?: string }> {
    const mutation = `
      mutation LiberarReservaCompensatoria($transaccionId: String!) {
        liberarReservaCompensatoria(transaccionId: $transaccionId) {
          exito
          mensaje
        }
      }
    `;

    try {
      this.logger.warn(
        `[TACTICAL-AUDIT SAGA ROLLBACK MS-03] Solicitando rollback de insumos en Inventario GraphQL...`,
      );
      this.logger.warn(
        `[GraphQL MS-03] Ejecutando compensación SAGA: liberarReservaCompensatoria para transacción '${transaccionId}'.`,
      );

      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: { transaccionId },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Error de respuesta HTTP');
        this.logger.error(
          `[TACTICAL-AUDIT SAGA ROLLBACK MS-03 ERROR] Fallo al solicitar liberación compensatoria en MS-03: HTTP ${response.status} - ${errorText}`,
        );
        return { exito: false, mensaje: `HTTP ${response.status} en rollback MS-03` };
      }

      const body = await response.json();
      if (body.errors && body.errors.length > 0) {
        const erroresMsg = body.errors.map((e: any) => e.message).join(' | ');
        this.logger.error(
          `[TACTICAL-AUDIT SAGA ROLLBACK MS-03 ERROR] Fallo al solicitar liberación compensatoria en MS-03: ${erroresMsg}`,
        );
        return { exito: false, mensaje: erroresMsg };
      }

      const resData = body.data?.liberarReservaCompensatoria;
      if (resData?.exito) {
        this.logger.log(
          `[TACTICAL-AUDIT SAGA ROLLBACK MS-03] Rollback de insumos confirmado en Inventario GraphQL. Transacción: ${transaccionId}`,
        );
      }
      return {
        exito: resData?.exito || false,
        mensaje: resData?.mensaje,
      };
    } catch (err: any) {
      this.logger.error(
        `[TACTICAL-AUDIT SAGA ROLLBACK MS-03 ERROR] Fallo al solicitar liberación compensatoria en MS-03: ${err.message}`,
      );
      this.logger.error(`Fallo al solicitar liberación compensatoria en MS-03: ${err.message}`);
      return { exito: false, mensaje: err.message };
    }
  }
}
