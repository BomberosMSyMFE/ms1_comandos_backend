import { ApiProperty } from '@nestjs/swagger';

export class CoordenadaGpsDto {
  @ApiProperty({ example: -17.7654 })
  lat: number;

  @ApiProperty({ example: -63.1432 })
  lng: number;

  @ApiProperty({ example: 'Parque Industrial PI-27, Santa Cruz' })
  dir: string;

  @ApiProperty({ example: 'Cuadrante Norte' })
  zona_cuadrante: string;
}

export class IncidenteResponseDto {
  @ApiProperty({ example: '0192e3a4-8f12-789a-bcde-000000000001' })
  id: string;

  @ApiProperty({ example: 'INC-2026-SCZ-001' })
  codigoRadial: string;

  @ApiProperty({ example: 'QUIMICO' })
  tipoIncidente: string;

  @ApiProperty({ example: 'CRITICA' })
  severidad: string;

  @ApiProperty({ example: 'Derrame de solvente industrial con combustión activa en galpón 4.' })
  descripcion: string;

  @ApiProperty({ example: 'PENDIENTE', enum: ['PENDIENTE', 'DESPACHADO', 'EN_COMBATE', 'CONTROLADO', 'CERRADO'] })
  estado: string;

  @ApiProperty({ type: CoordenadaGpsDto })
  ubicacion: CoordenadaGpsDto;

  @ApiProperty({ example: 0 })
  unidadesAsignadas: number;

  @ApiProperty({ example: 'usr_0192e3a4-8f12-789a-bcde-000000000001' })
  operadorId: string;

  @ApiProperty({ example: '2026-11-02T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-11-02T10:00:00.000Z' })
  updatedAt: string;
}
