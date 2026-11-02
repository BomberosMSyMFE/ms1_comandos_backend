import { Injectable, Logger } from '@nestjs/common';
import {
  IInventarioClientPort,
  InsumoReservaItem,
  ReservaInsumosResponse,
} from '../../../application/ports/inventario-client.port';

@Injectable()
export class MockInventarioClient implements IInventarioClientPort {
  private readonly logger = new Logger(MockInventarioClient.name);

  async reservarInsumos(
    incidenteId: string,
    camionId: string,
    insumos?: InsumoReservaItem[],
    litrosEspumogeno?: number,
  ): Promise<ReservaInsumosResponse> {
    const litros = litrosEspumogeno || 250.0;
    this.logger.log(
      `[MOCK MS-03 INVENTARIO] GraphQL Mutation reservarKitParaDespacho: incidente='${incidenteId}', camion='${camionId}', litros=${litros}.`,
    );

    // Caso de prueba para simular rechazo por regla de dominio (Jael: stock insuficiente o presión < 250 bar)
    const itemAgotado = insumos?.find((i) => i.insumoId === 'INS-SIN-STOCK' || i.cantidad > 1000);
    if (itemAgotado || litros > 1000 || camionId === 'CAM-SIN-STOCK') {
      this.logger.warn(`[MOCK MS-03 INVENTARIO] Invariante violada: Stock insuficiente o tanques con presión < 250 bar.`);
      return {
        exito: false,
        error: 'Stock insuficiente en almacén o tanques con presión < 250 bares (Norma NFPA).',
      };
    }

    const txId = `TX-SAGA-INV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    return {
      exito: true,
      transaccionId: txId,
      materialesReservados: `1x Kit EPP (300 bar) + ${litros}L Espumógeno AFFF 3%`,
    };
  }

  async liberarInsumos(transaccionId: string, incidenteId?: string): Promise<{ exito: boolean; mensaje?: string }> {
    this.logger.warn(
      `[MOCK MS-03 INVENTARIO] Acción Compensatoria SAGA: Liberando reserva '${transaccionId}' (Reversión a DISPONIBLE).`,
    );
    return {
      exito: true,
      mensaje: `Reserva ${transaccionId} compensada con éxito.`,
    };
  }
}
