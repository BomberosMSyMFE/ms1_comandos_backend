export interface OpcionesReservaCamion {
  camionId?: string;
  latitud?: number;
  longitud?: number;
  litrosMinimos?: number;
}

export interface ReservaCamionResponse {
  exito: boolean;
  camionId: string;
  reservaId?: string;
  placa?: string;
  tipoUnidad?: string;
  capacidadAguaLts?: number;
  tiempoLlegadaMinutos: number;
  distanciaKms?: number;
  estacionOrigen?: string;
  error?: string;
}

export interface IFlotasClientPort {
  reservarCamion(
    incidenteId: string,
    tipoFuego: string,
    opciones?: OpcionesReservaCamion | string,
  ): Promise<ReservaCamionResponse>;

  liberarCamion(
    incidenteId: string,
    camionId: string,
    motivoCompensacion?: string,
  ): Promise<{ exito: boolean; mensaje?: string }>;
}
