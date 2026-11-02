export interface ReservaCamionResponse {
  exito: boolean;
  camionId: string;
  tiempoLlegadaMinutos: number;
  error?: string;
}

export interface IFlotasClientPort {
  reservarCamion(incidenteId: string, tipoFuego: string, camionId?: string): Promise<ReservaCamionResponse>;
  liberarCamion(incidenteId: string, camionId: string): Promise<{ exito: boolean }>;
}
