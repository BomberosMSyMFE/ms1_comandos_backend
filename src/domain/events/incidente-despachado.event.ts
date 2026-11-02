export class IncidenteDespachadoEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly incidenteId: string,
    public readonly camionId: string,
    public readonly operadorId: string,
    public readonly sagaId: string,
    public readonly fechaDespacho: string = new Date().toISOString(),
  ) {
    this.occurredOn = new Date();
  }
}
