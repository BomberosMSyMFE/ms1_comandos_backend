export interface InsumoReservaItem {
  insumoId: string;
  cantidad: number;
}

export interface ReservaInsumosResponse {
  exito: boolean;
  transaccionId?: string;
  materialesReservados?: string;
  error?: string;
}

export interface IInventarioClientPort {
  reservarInsumos(
    incidenteId: string,
    camionId: string,
    insumos?: InsumoReservaItem[],
    litrosEspumogeno?: number,
  ): Promise<ReservaInsumosResponse>;

  liberarInsumos(transaccionId: string, incidenteId?: string): Promise<{ exito: boolean; mensaje?: string }>;
}
