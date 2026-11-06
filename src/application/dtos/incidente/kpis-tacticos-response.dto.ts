import { ApiProperty } from '@nestjs/swagger';

export class KpisTacticosResponseDto {
  @ApiProperty({
    example: 45,
    description: 'Conteo real de incidentes activos en estado distinto a CERRADO, CONTROLADO o LIQUIDADO',
  })
  incidentesActivos: number;

  @ApiProperty({
    example: 35,
    description: 'Total de incidentes o unidades en combate activo (estados EN_COMBATE o DESPACHADO)',
  })
  camionesEnCombate: number;

  @ApiProperty({
    example: 43,
    description: 'Hidrantes operativos consultados o valor de la base operativa de Santa Cruz (43 de 45 operativos)',
  })
  hidrantesOperativos: number;

  @ApiProperty({
    example: 395000,
    description: 'Acumulado hídrico disponible en litros entre incidentes activos y cisternas en servicio',
  })
  litrosAguaDisponibles: number;
}
