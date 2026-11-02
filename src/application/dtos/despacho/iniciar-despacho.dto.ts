import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InsumoRequeridoDto {
  @ApiProperty({ example: 'INS-ESPUMA-AFFF', description: 'Código o ID del insumo' })
  @IsNotEmpty()
  @IsString()
  insumoId: string;

  @ApiProperty({ example: 200, description: 'Cantidad en litros o unidades' })
  @IsNotEmpty()
  cantidad: number;
}

export class IniciarDespachoDto {
  @ApiProperty({ example: '0192e3a4-8f12-789a-bcde-000000000001', description: 'ID del incidente a despachar' })
  @IsNotEmpty()
  @IsString()
  incidenteId: string;

  @ApiPropertyOptional({ example: 'CAM-B04', description: 'ID del camión a reservar (o asignación automática si se omite)' })
  @IsOptional()
  @IsString()
  camionId?: string;

  @ApiPropertyOptional({ example: 'BOM-004', description: 'ID del bombero conductor' })
  @IsOptional()
  @IsString()
  conductorId?: string;

  @ApiPropertyOptional({ type: [InsumoRequeridoDto], description: 'Insumos que deben reservarse en inventario' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InsumoRequeridoDto)
  insumosRequeridos?: InsumoRequeridoDto[];
}
