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

      const body = await response.json();
      if (body.errors && body.errors.length > 0) {
        this.logger.warn(`[GraphQL MS-03] Error en respuesta: ${body.errors[0].message}`);
        return {
          exito: false,
          error: body.errors[0].message || 'Error en GraphQL MS-03 Inventario',
        };
      }

      const resData = body.data?.reservarKitParaDespacho;
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

      const body = await response.json();
      const resData = body.data?.liberarReservaCompensatoria;
      return {
        exito: resData?.exito || false,
        mensaje: resData?.mensaje,
      };
    } catch (err: any) {
      this.logger.error(`Fallo al solicitar liberación compensatoria en MS-03: ${err.message}`);
      return { exito: false, mensaje: err.message };
    }
  }
}
