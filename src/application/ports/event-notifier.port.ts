export interface IEventNotifierPort {
  notificarIncidenteCreado(incidente: any): Promise<void>;
  notificarIncidenteDespachado(datos: any): Promise<void>;
  notificarCambioEstado(incidenteId: string, estado: string, historial: any): Promise<void>;
  notificarAlerta(alerta: any): Promise<void>;
}
