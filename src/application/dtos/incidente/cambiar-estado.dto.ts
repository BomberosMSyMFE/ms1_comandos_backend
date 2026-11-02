import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoIncidente } from '../../../domain/value-objects/estado-incidente.vo';

export class CambiarEstadoIncidenteDto {
  @ApiProperty({ example: 'EN_COMBATE', enum: EstadoIncidente })
  @IsEnum(EstadoIncidente)
  nuevoEstado: EstadoIncidente;

  @ApiProperty({ example: 'Unidad B-04 presurizando líneas de mangueras e ingresando a estructura.' })
  @IsNotEmpty()
  @IsString()
  novedadTexto: string;

  @ApiPropertyOptional({ example: 8500, description: 'Nivel de agua reportado en cisterna (litros)' })
  @IsOptional()
  @IsNumber()
  nivelAguaActual?: number;
}
