import { Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { IReporteRepository } from '../../../domain/repositories/reporte.repository.interface';
import { ReporteEjecutivo } from '../../../domain/entities/reporte-ejecutivo.entity';

@Injectable()
export class DynamoDbReporteRepository implements IReporteRepository {
  private readonly tableName = 'tb_reportes_ejecutivos';

  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async guardar(reporte: ReporteEjecutivo): Promise<void> {
    const item = {
      reporte_id: reporte.id,
      comandante_id: reporte.comandanteId,
      titulo: reporte.titulo,
      comando_voz_origen: reporte.comandoVozOrigen,
      formatos_disponibles: reporte.formatosDisponibles,
      metricas_resumen: reporte.metricasResumen,
      archivo_pdf_url: reporte.archivoPdfUrl || null,
      archivo_excel_url: reporte.archivoExcelUrl || null,
      archivo_audio_url: reporte.archivoAudioUrl || null,
      fecha_generacion: reporte.createdAt,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async buscarPorId(id: string): Promise<ReporteEjecutivo | null> {
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { reporte_id: id },
      }),
    );

    if (!response.Item) return null;
    return this.mapToDomain(response.Item);
  }

  async listarPorComandante(comandanteId: string): Promise<ReporteEjecutivo[]> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI_ComandanteFecha',
        KeyConditionExpression: 'comandante_id = :cmdId',
        ExpressionAttributeValues: {
          ':cmdId': comandanteId,
        },
      }),
    );

    return (response.Items || []).map((item) => this.mapToDomain(item));
  }

  async listarTodos(): Promise<ReporteEjecutivo[]> {
    const response = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
      }),
    );

    return (response.Items || []).map((item) => this.mapToDomain(item));
  }

  private mapToDomain(item: any): ReporteEjecutivo {
    return new ReporteEjecutivo(
      item.reporte_id,
      item.comandante_id,
      item.titulo,
      item.comando_voz_origen,
      item.formatos_disponibles || [],
      item.metricas_resumen || {},
      item.archivo_pdf_url || undefined,
      item.archivo_excel_url || undefined,
      item.archivo_audio_url || undefined,
      item.fecha_generacion,
    );
  }
}
