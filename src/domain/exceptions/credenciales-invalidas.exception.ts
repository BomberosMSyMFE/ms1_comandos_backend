export class CredencialesInvalidasException extends Error {
  constructor(mensaje = 'Credenciales de acceso inválidas.') {
    super(mensaje);
    this.name = 'CredencialesInvalidasException';
  }
}
