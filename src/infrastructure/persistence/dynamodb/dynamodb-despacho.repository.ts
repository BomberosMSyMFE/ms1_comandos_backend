import { Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { IDespachoRepository } from '../../../domain/repositories/despacho.repository.interface';
import { DespachoTactico, EstadoDespacho } from '../../../domain/entities/despacho-tactico.entity';

@Injectable()
export class DynamoDbDespachoRepository implements IDespachoRepository {
  private readonly tableName = 'tb_despachos_tacticos';

  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async guardar(despacho: DespachoTactico): Promise<void> {
    const item = {
      despacho_id: despacho.despachoId,
      incidente_id: despacho.incidenteId,
      camion_id: despacho.camionId,
      conductor_id: despacho.conductorId,
      operador_autoriza: despacho.operadorAutoriza,
      estado_despacho: despacho.estadoDespacho,
      insumos_asociados: despacho.insumosAsociados,
      fecha_despacho: despacho.horaDespacho,
      hora_arribo: despacho.horaArribo || null,
      hora_liberacion: despacho.horaLiberacion || null,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async buscarPorId(despachoId: string): Promise<DespachoTactico | null> {
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { despacho_id: despachoId },
      }),
    );

    if (!response.Item) return null;
    return this.mapToDomain(response.Item);
  }

  async listarPorIncidente(incidenteId: string): Promise<DespachoTactico[]> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI_IncidenteFecha',
        KeyConditionExpression: 'incidente_id = :incId',
        ExpressionAttributeValues: {
          ':incId': incidenteId,
        },
      }),
    );

    return (response.Items || []).map((item) => this.mapToDomain(item));
  }

  private mapToDomain(item: any): DespachoTactico {
    return new DespachoTactico(
      item.despacho_id,
      item.incidente_id,
      item.camion_id,
      item.conductor_id,
      item.operador_autoriza,
      item.insumos_asociados || [],
      item.fecha_despacho,
      item.estado_despacho as EstadoDespacho,
      item.hora_arribo || undefined,
      item.hora_liberacion || undefined,
    );
  }
}
