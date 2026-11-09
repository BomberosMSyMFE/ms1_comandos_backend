import { CoordenadaGPS } from '../value-objects/coordenada-gps.vo';
import { EstadoIncidente } from '../value-objects/estado-incidente.vo';
import { NivelSeveridad } from '../value-objects/nivel-severidad.vo';
import { EstadoInvalidoException } from '../exceptions/estado-invalido.exception';

export type TipoIncidente = 'ESTRUCTURAL' | 'FORESTAL' | 'QUIMICO' | 'RESCATE' | 'VEHICULAR';

export interface DenuncianteInfo {
  nombre: string;
  telefono: string;
}

export class IncidenteEmergencia {
  private _estado: EstadoIncidente;
  private _unidadesAsignadas: number;
  private _camionAsignado?: string;
  private _updatedAt: string;

  constructor(
    public readonly id: string,
    public readonly codigoRadial: string,
    public tipoIncidente: TipoIncidente,
    public severidad: NivelSeveridad,
    public descripcion: string,
    public ubicacion: CoordenadaGPS,
    public operadorId: string,
    estadoInicial: EstadoIncidente = EstadoIncidente.PENDIENTE,
    unidadesAsignadasInicial = 0,
    public denunciante?: DenuncianteInfo,
    public readonly createdAt: string = new Date().toISOString(),
    updatedAt?: string,
    camionAsignado?: string,
  ) {
    this._estado = estadoInicial;
    this._unidadesAsignadas = unidadesAsignadasInicial;
    this._updatedAt = updatedAt || createdAt;
    this._camionAsignado = camionAsignado;
  }

  get estado(): EstadoIncidente {
    return this._estado;
  }

  get camionAsignado(): string | undefined {
    return this._camionAsignado;
  }

  get unidadesAsignadas(): number {
    return this._unidadesAsignadas;
  }

  get updatedAt(): string {
    return this._updatedAt;
  }

  public validarDespacho(camionId: string): void {
    if (
      this._estado === EstadoIncidente.CONTROLADO ||
      this._estado === EstadoIncidente.CERRADO ||
      this._estado === EstadoIncidente.LIQUIDADO
    ) {
      throw new EstadoInvalidoException(
        `No se puede despachar la unidad '${camionId}'. El incidente '${this.id}' se encuentra en estado '${this._estado}'.`,
      );
    }
  }

  public despachar(camionId: string): void {
    this.validarDespacho(camionId);
    this._estado = EstadoIncidente.DESPACHADO;
    this._camionAsignado = camionId;
    this._unidadesAsignadas += 1;
    this._updatedAt = new Date().toISOString();
  }

  public restaurarEstado(estadoPrevio: EstadoIncidente, unidadesPrevias: number): void {
    this._estado = estadoPrevio;
    this._unidadesAsignadas = unidadesPrevias;
    if (unidadesPrevias === 0) {
      this._camionAsignado = undefined;
    }
    this._updatedAt = new Date().toISOString();
  }

  public marcarEnCombate(): void {
    if (this._estado === EstadoIncidente.CERRADO || this._estado === EstadoIncidente.LIQUIDADO) {
      throw new EstadoInvalidoException(`No se puede marcar en combate un incidente ya finalizado.`);
    }
    this._estado = EstadoIncidente.EN_COMBATE;
    this._updatedAt = new Date().toISOString();
  }

  public controlar(): void {
    if (this._estado === EstadoIncidente.PENDIENTE) {
      throw new EstadoInvalidoException(`No se puede dar por controlado un incidente que aún está pendiente.`);
    }
    if (this._estado === EstadoIncidente.CERRADO || this._estado === EstadoIncidente.LIQUIDADO) {
      throw new EstadoInvalidoException(`El incidente ya fue finalizado definitivamente.`);
    }
    this._estado = EstadoIncidente.CONTROLADO;
    this._updatedAt = new Date().toISOString();
  }

  public liquidar(): void {
    if (this._estado !== EstadoIncidente.CONTROLADO && this._estado !== EstadoIncidente.EN_COMBATE) {
      throw new EstadoInvalidoException(
        `Regla de negocio: El incidente debe estar en estado 'CONTROLADO' o 'EN_COMBATE' antes de liquidarse. Estado actual: '${this._estado}'.`,
      );
    }
    this._estado = EstadoIncidente.LIQUIDADO;
    this._updatedAt = new Date().toISOString();
  }

  public cerrar(): void {
    if (this._estado !== EstadoIncidente.CONTROLADO && this._estado !== EstadoIncidente.LIQUIDADO) {
      throw new EstadoInvalidoException(
        `Regla de negocio: El incidente debe estar en estado 'CONTROLADO' o 'LIQUIDADO' antes de cerrarse formalmente. Estado actual: '${this._estado}'.`,
      );
    }
    this._estado = EstadoIncidente.CERRADO;
    this._updatedAt = new Date().toISOString();
  }

  public revertirDespacho(): void {
    if (this._unidadesAsignadas > 0) {
      this._unidadesAsignadas -= 1;
    }
    if (this._unidadesAsignadas === 0 && this._estado === EstadoIncidente.DESPACHADO) {
      this._estado = EstadoIncidente.PENDIENTE;
    }
    this._updatedAt = new Date().toISOString();
  }
}
