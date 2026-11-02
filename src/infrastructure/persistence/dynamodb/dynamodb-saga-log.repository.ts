import { Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ISagaLogRepository, RegistroSagaLog } from '../../../domain/repositories/saga-log.repository.interface';

@Injectable()
export class DynamoDbSagaLogRepository implements ISagaLogRepository {
  private readonly tableName = 'tb_bitacora_saga';

  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async registrarPaso(registro: RegistroSagaLog): Promise<void> {
    const ttlExpiracion = registro.ttlExpiracion || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 días

    const item = {
      saga_id: registro.sagaId,
      timestamp: registro.timestamp,
      incidente_id: registro.incidenteId,
      estado_saga: registro.estadoSaga,
      paso_actual: registro.pasoActual,
      idempotency_key: registro.idempotencyKey || null,
      detalle_error: registro.detalleError || null,
      payload_rollback: registro.payloadRollback || null,
      ttl_expiracion: ttlExpiracion,
    };

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

  private mapToDomain(item: any): RegistroSagaLog {
    return {
      sagaId: item.saga_id,
      timestamp: item.timestamp,
      incidenteId: item.incidente_id,
      estadoSaga: item.estado_saga,
      pasoActual: item.paso_actual,
      idempotencyKey: item.idempotency_key || undefined,
      detalleError: item.detalle_error || undefined,
      payloadRollback: item.payload_rollback || undefined,
      ttlExpiracion: item.ttl_expiracion,
    };
  }
}
