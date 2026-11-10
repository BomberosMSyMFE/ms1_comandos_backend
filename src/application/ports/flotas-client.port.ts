export interface OpcionesReservaCamion {
  camionId?: string;
  latitud?: number;
  longitud?: number;
  litrosMinimos?: number;
  direccion?: string;
  ubicacion?: string;
  cuadrante?: string;
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

export interface NotificacionDespachoParams {
  unidadId: string;
  incidenteId: string;
  tipoIncidente: string;
  ubicacion: string;
  latitud: number;
  longitud: number;
  prioridad: string;
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

  notificarDespacho?(
    params: NotificacionDespachoParams,
  ): Promise<{ exito: boolean; mensaje?: string }>;
}
