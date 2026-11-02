export class HistorialIncidente {
  constructor(
    public readonly incidenteId: string,
    public readonly timestamp: number,
    public readonly eventoId: string,
    public readonly estadoAnterior: string | null,
    public readonly estadoNuevo: string,
    public readonly operadorId: string,
    public readonly novedadTexto: string,
    public readonly nivelAguaActual?: number,
  ) {}

  public static registrar(
    incidenteId: string,
    estadoNuevo: string,
    operadorId: string,
    novedadTexto: string,
    estadoAnterior: string | null = null,
    nivelAguaActual?: number,
  ): HistorialIncidente {
    const timestamp = Date.now();
    const eventoId = `evt_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
    return new HistorialIncidente(
      incidenteId,
      timestamp,
      eventoId,
      estadoAnterior,
      estadoNuevo,
      operadorId,
      novedadTexto,
      nivelAguaActual,
    );
  }
}
