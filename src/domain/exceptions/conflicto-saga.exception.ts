export class ConflictoSagaException extends Error {
  constructor(
    public readonly sagaId: string,
    public readonly pasoFallo: string,
    public readonly motivo: string,
    public readonly compensado: boolean = true,
  ) {
    super(`Fallo en SAGA [${sagaId}] en el paso '${pasoFallo}': ${motivo}. Compensación ejecutada: ${compensado}`);
    this.name = 'ConflictoSagaException';
  }
}
