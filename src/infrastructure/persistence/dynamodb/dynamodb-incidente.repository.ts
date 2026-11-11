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
      camion_asignado: incidente.camionAsignado || null,
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
    const idTrim = (id || '').trim();
    if (!idTrim || idTrim === 'undefined' || idTrim === 'null') return null;

    const idUpper = idTrim.toUpperCase();

    // Normalizaciones inteligentes de código de camión (ej. CAM-B08 <-> B-08 <-> B08)
    const cleanCam = idUpper.replace(/^CAM-?/, '').trim();
    const camMatch = cleanCam.match(/^([A-Z]+)-?(\d+)$/);
    const camVariations = camMatch
      ? [`${camMatch[1]}-${camMatch[2]}`, `${camMatch[1]}${camMatch[2]}`, `CAM-${camMatch[1]}-${camMatch[2]}`, `CAM-${camMatch[1]}${camMatch[2]}`]
      : [cleanCam];

    // 1. Intento directo por Primary Key (incidente_id UUID)
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { incidente_id: idTrim },
      }),
    );

    if (response.Item) return this.mapToDomain(response.Item);

    // 2. Fallback: Buscar por código radial táctico, UUID alternativo o Camión Asignado (con variaciones CAM-Bxx / B-xx)
    // NOTA: NO usar Limit: 1 en DynamoDB Scan porque Limit evalúa antes del FilterExpression
    const scanResponse = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression:
          'codigo_radial = :id or incidente_id = :id or codigo_radial = :idUpper or incidente_id = :idUpper or ' +
          'camion_asignado = :id or camion_asignado = :idUpper or ' +
          'camion_asignado = :camVar0 or camion_asignado = :camVar1',
        ExpressionAttributeValues: {
          ':id': idTrim,
          ':idUpper': idUpper,
          ':camVar0': camVariations[0] || idUpper,
          ':camVar1': camVariations[1] || idUpper,
        },
      }),
    );

    if (scanResponse.Items && scanResponse.Items.length > 0) {
      // 1. Prioridad Absoluta: Coincidencia EXACTA por código radial o ID
      const exacto = scanResponse.Items.find(
        (i) =>
          i.codigo_radial === idTrim ||
          i.codigo_radial === idUpper ||
          i.incidente_id === idTrim ||
          i.incidente_id === idUpper,
      );
      if (exacto) return this.mapToDomain(exacto);

      // 2. Si se buscó por camión, priorizar el siniestro activo en combate o despacho más reciente
      const activos = scanResponse.Items.filter(
        (i) => i.estado !== EstadoIncidente.CERRADO && i.estado !== EstadoIncidente.LIQUIDADO,
      );
      if (activos.length > 0) {
        activos.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at || 0).getTime() -
            new Date(a.updated_at || a.created_at || 0).getTime(),
        );
        return this.mapToDomain(activos[0]);
      }

      return this.mapToDomain(scanResponse.Items[0]);
    }

    return null;
  }

  async listarActivos(): Promise<IncidenteEmergencia[]> {
    const response = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: '#st <> :liquidado',
        ExpressionAttributeNames: {
          '#st': 'estado',
        },
        ExpressionAttributeValues: {
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
      item.camion_asignado || undefined,
    );
  }
}
