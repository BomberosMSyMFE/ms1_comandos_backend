export class EstadoInvalidoException extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'EstadoInvalidoException';
  }
}
