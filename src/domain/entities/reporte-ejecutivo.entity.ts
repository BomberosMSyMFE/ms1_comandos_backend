export class ReporteEjecutivo {
  constructor(
    public readonly id: string,
    public readonly comandanteId: string,
    public readonly titulo: string,
    public readonly comandoVozOrigen: string,
    public readonly formatosDisponibles: string[],
    public readonly metricasResumen: Record<string, any>,
    public readonly archivoPdfUrl?: string,
    public readonly archivoExcelUrl?: string,
    public readonly archivoAudioUrl?: string,
    public readonly createdAt: string = new Date().toISOString(),
  ) {}
}
