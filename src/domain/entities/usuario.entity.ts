import { RolUsuario } from '../value-objects/rol-usuario.vo';

export class Usuario {
  private _ultimoLogin?: string;
  private _activo: boolean;
  private _telefonoMovil: string;

  constructor(
    public readonly id: string,
    public readonly nombreCompleto: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly rol: RolUsuario,
    public readonly estacionBase: string,
    activo = true,
    ultimoLogin?: string,
    public readonly createdAt: string = new Date().toISOString(),
    telefonoMovil = '',
  ) {
    this._activo = activo;
    this._ultimoLogin = ultimoLogin;
    this._telefonoMovil = telefonoMovil;
  }

  get activo(): boolean {
    return this._activo;
  }

  get ultimoLogin(): string | undefined {
    return this._ultimoLogin;
  }

  get telefonoMovil(): string {
    return this._telefonoMovil;
  }

  public actualizarUltimoLogin(): void {
    this._ultimoLogin = new Date().toISOString();
  }

  public actualizarTelefonoMovil(telefono: string): void {
    this._telefonoMovil = telefono;
  }

  public desactivar(): void {
    this._activo = false;
  }

  public activar(): void {
    this._activo = true;
  }
}

