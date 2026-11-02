export type EstadoDespacho = 'EN_RUTA' | 'EN_ESCENA' | 'LIBERADO';

export interface InsumoDespachado {
  insumoId: string;
  nombre: string;
  cantidad: number;
}

export class DespachoTactico {
  private _estadoDespacho: EstadoDespacho;
  private _horaArribo?: string;
  private _horaLiberacion?: string;

  constructor(
    public readonly despachoId: string,
    public readonly incidenteId: string,
    public readonly camionId: string,
    public readonly conductorId: string,
    public readonly operadorAutoriza: string,
    public readonly insumosAsociados: InsumoDespachado[] = [],
    public readonly horaDespacho: string = new Date().toISOString(),
    estadoInicial: EstadoDespacho = 'EN_RUTA',
    horaArribo?: string,
    horaLiberacion?: string,
  ) {
    this._estadoDespacho = estadoInicial;
    this._horaArribo = horaArribo;
    this._horaLiberacion = horaLiberacion;
  }

  get estadoDespacho(): EstadoDespacho {
    return this._estadoDespacho;
  }

  get horaArribo(): string | undefined {
    return this._horaArribo;
  }

  get horaLiberacion(): string | undefined {
    return this._horaLiberacion;
  }

  public registrarLlegada(): void {
    this._estadoDespacho = 'EN_ESCENA';
    this._horaArribo = new Date().toISOString();
  }

  public liberarUnidad(): void {
    this._estadoDespacho = 'LIBERADO';
    this._horaLiberacion = new Date().toISOString();
  }
}
