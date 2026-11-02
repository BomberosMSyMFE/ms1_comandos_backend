import { ApiProperty } from '@nestjs/swagger';

export class DatosDespachoDto {
  @ApiProperty({ example: '0192e3a4-8f12-789a-bcde-000000000001' })
  incidenteId: string;

  @ApiProperty({ example: 'DESPACHADO' })
  estadoActual: string;

  @ApiProperty({ example: 'CAM-B04' })
  camionAsignado: string;

  @ApiProperty({ example: 7.5, description: 'Tiempo estimado de arribo en minutos' })
  tiempoEstimadoArriboMinutos: number;

  @ApiProperty({ example: 'desp_0192e3a4-8f12-789a-0001' })
  despachoId: string;
}

export class ResultadoDespachoDto {
  @ApiProperty({ example: 'EXITO', enum: ['EXITO', 'COMPENSACION_EJECUTADA'] })
  status: string;

  @ApiProperty({ example: 'saga_0192e3a5-bc12-7000-8000-111122223333' })
  sagaId: string;

  @ApiProperty({ example: 'Unidad despachada e insumos reservados con éxito.' })
  mensaje: string;

  @ApiProperty({ type: DatosDespachoDto, required: false })
  datos?: DatosDespachoDto;

  @ApiProperty({ example: 'STOCK_INSUFICIENTE_INVENTARIO', required: false })
  codigoError?: string;

  @ApiProperty({ example: 'PENDIENTE', required: false })
  incidenteEstado?: string;
}
