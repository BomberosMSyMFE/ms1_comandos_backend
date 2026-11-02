export class IncidenteNoEncontradoException extends Error {
  constructor(id: string) {
    super(`El incidente con ID '${id}' no fue encontrado.`);
    this.name = 'IncidenteNoEncontradoException';
  }
}
