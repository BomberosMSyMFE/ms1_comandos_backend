export interface RegistroSagaLog {
  sagaId: string;
  timestamp: number;
  incidenteId: string;
  incidenteCodigo?: string;
  estadoSaga: string;
  pasoActual: string;
  idempotencyKey?: string;
  detalleError?: string;
  payloadRollback?: Record<string, any>;
  ttlExpiracion?: number;
}

export interface ISagaLogRepository {
  registrarPaso(registro: RegistroSagaLog): Promise<void>;
  buscarPorSagaId(sagaId: string): Promise<RegistroSagaLog[]>;
  buscarPorIdempotencyKey(key: string): Promise<RegistroSagaLog | null>;
  listarRecientes(limite?: number): Promise<RegistroSagaLog[]>;
}
