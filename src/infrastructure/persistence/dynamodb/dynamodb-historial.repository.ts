import { Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { IHistorialRepository } from '../../../domain/repositories/historial.repository.interface';
import { HistorialIncidente } from '../../../domain/entities/historial-incidente.entity';

@Injectable()
export class DynamoDbHistorialRepository implements IHistorialRepository {
  private readonly tableName = 'tb_historial_incidente';

  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async guardar(historial: HistorialIncidente): Promise<void> {
    const item = {
      incidente_id: historial.incidenteId,
      timestamp: historial.timestamp,
      evento_id: historial.eventoId,
      estado_anterior: historial.estadoAnterior || null,
      estado_nuevo: historial.estadoNuevo,
      operador_id: historial.operadorId,
      novedad_texto: historial.novedadTexto,
      nivel_agua_actual: historial.nivelAguaActual !== undefined ? historial.nivelAguaActual : null,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async obtenerTimelinePorIncidente(incidenteId: string): Promise<HistorialIncidente[]> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'incidente_id = :incId',
        ExpressionAttributeValues: {
          ':incId': incidenteId,
        },
        ScanIndexForward: true, // Orden cronológico ascendente
      }),
    );

    return (response.Items || []).map(
      (item) =>
        new HistorialIncidente(
          item.incidente_id,
          item.timestamp,
          item.evento_id,
          item.estado_anterior,
          item.estado_nuevo,
          item.operador_id,
          item.novedad_texto,
          item.nivel_agua_actual !== null ? item.nivel_agua_actual : undefined,
        ),
    );
  }
}
