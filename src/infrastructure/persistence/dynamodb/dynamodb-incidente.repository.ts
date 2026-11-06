import { Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { IIncidenteRepository } from '../../../domain/repositories/incidente.repository.interface';
import { IncidenteEmergencia, TipoIncidente } from '../../../domain/entities/incidente-emergencia.entity';
import { CoordenadaGPS } from '../../../domain/value-objects/coordenada-gps.vo';
import { EstadoIncidente } from '../../../domain/value-objects/estado-incidente.vo';
import { NivelSeveridad } from '../../../domain/value-objects/nivel-severidad.vo';

@Injectable()
export class DynamoDbIncidenteRepository implements IIncidenteRepository {
  private readonly tableName = 'tb_incidentes_emergencia';

  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async guardar(incidente: IncidenteEmergencia): Promise<void> {
    const item = {
      incidente_id: incidente.id,
      codigo_radial: incidente.codigoRadial,
      tipo_incidente: incidente.tipoIncidente,
      severidad: incidente.severidad,
      descripcion: incidente.descripcion,
      estado: incidente.estado,
      ubicacion: incidente.ubicacion.toJSON(),
      unidades_asignadas: incidente.unidadesAsignadas,
      operador_id: incidente.operadorId,
      denunciante: incidente.denunciante || null,
      created_at: incidente.createdAt,
      updated_at: incidente.updatedAt,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async buscarPorId(id: string): Promise<IncidenteEmergencia | null> {
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { incidente_id: id },
      }),
    );

    if (!response.Item) return null;
    return this.mapToDomain(response.Item);
  }

  async listarActivos(): Promise<IncidenteEmergencia[]> {
    const response = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: '#st <> :cerrado AND #st <> :liquidado',
        ExpressionAttributeNames: {
          '#st': 'estado',
        },
        ExpressionAttributeValues: {
          ':cerrado': EstadoIncidente.CERRADO,
          ':liquidado': EstadoIncidente.LIQUIDADO,
        },
      }),
    );

    return (response.Items || []).map((item) => this.mapToDomain(item));
  }

  async listarTodos(): Promise<IncidenteEmergencia[]> {
    const response = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
      }),
    );

    return (response.Items || []).map((item) => this.mapToDomain(item));
  }

  private mapToDomain(item: any): IncidenteEmergencia {
    const ubicacion = new CoordenadaGPS(
      item.ubicacion?.lat || 0,
      item.ubicacion?.lng || 0,
      item.ubicacion?.dir,
      item.ubicacion?.zona_cuadrante,
    );

    return new IncidenteEmergencia(
      item.incidente_id,
      item.codigo_radial,
      item.tipo_incidente as TipoIncidente,
      item.severidad as NivelSeveridad,
      item.descripcion,
      ubicacion,
      item.operador_id,
      item.estado as EstadoIncidente,
      item.unidades_asignadas || 0,
      item.denunciante || undefined,
      item.created_at,
      item.updated_at,
    );
  }
}
