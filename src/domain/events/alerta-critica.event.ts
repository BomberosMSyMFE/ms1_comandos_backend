export class AlertaCriticaEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly alertaId: string,
    public readonly tipo: string,
    public readonly severidad: string,
    public readonly mensaje: string,
    public readonly ubicacion: { lat: number; lng: number; dir?: string },
    public readonly timestamp: string = new Date().toISOString(),
  ) {
    this.occurredOn = new Date();
  }
}
