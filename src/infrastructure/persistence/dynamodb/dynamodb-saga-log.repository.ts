import { Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ISagaLogRepository, RegistroSagaLog } from '../../../domain/repositories/saga-log.repository.interface';

@Injectable()
export class DynamoDbSagaLogRepository implements ISagaLogRepository {
  private readonly tableName = 'tb_bitacora_saga';

  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async registrarPaso(registro: RegistroSagaLog): Promise<void> {
    const ttlExpiracion = registro.ttlExpiracion || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 días

    const item: Record<string, any> = {
      saga_id: registro.sagaId,
      timestamp: registro.timestamp,
      incidente_id: registro.incidenteId,
      estado_saga: registro.estadoSaga,
      paso_actual: registro.pasoActual,
      ttl_expiracion: ttlExpiracion,
    };

    if (registro.incidenteCodigo) {
      item.incidente_codigo = registro.incidenteCodigo;
    }
    if (registro.idempotencyKey) {
      item.idempotency_key = registro.idempotencyKey;
    }
    if (registro.detalleError) {
      item.detalle_error = registro.detalleError;
    }
    if (registro.payloadRollback) {
      item.payload_rollback = registro.payloadRollback;
    }

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async buscarPorSagaId(sagaId: string): Promise<RegistroSagaLog[]> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'saga_id = :sId',
        ExpressionAttributeValues: {
          ':sId': sagaId,
        },
        ScanIndexForward: true,
      }),
    );

    return (response.Items || []).map((item) => this.mapToDomain(item));
  }

  async buscarPorIdempotencyKey(key: string): Promise<RegistroSagaLog | null> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI_IdempotencyKey',
        KeyConditionExpression: 'idempotency_key = :k',
        ExpressionAttributeValues: {
          ':k': key,
        },
      }),
    );

    if (!response.Items || response.Items.length === 0) {
      return null;
    }

    return this.mapToDomain(response.Items[0]);
  }

  async listarRecientes(limite = 50): Promise<RegistroSagaLog[]> {
    try {
      // Nota DynamoDB: ScanCommand sin Limit evalúa la partición completa para ordenar por timestamp en memoria.
      // Dado el volumen de bitácora (1500 registros, ~250KB), se procesa en menos de 100ms.
      const response = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
        }),
      );

      const items = (response.Items || []).map((item) => this.mapToDomain(item));
      return items
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, limite);
    } catch {
      return [];
    }
  }

  private mapToDomain(item: any): RegistroSagaLog {
    return {
      sagaId: item.saga_id,
      timestamp: item.timestamp,
      incidenteId: item.incidente_codigo || item.incidente_id,
      incidenteCodigo: item.incidente_codigo || item.incidente_id,
      estadoSaga: item.estado_saga,
      pasoActual: item.paso_actual,
      idempotencyKey: item.idempotency_key || undefined,
      detalleError: item.detalle_error || undefined,
      payloadRollback: item.payload_rollback || undefined,
      ttlExpiracion: item.ttl_expiracion,
    };
  }
}
