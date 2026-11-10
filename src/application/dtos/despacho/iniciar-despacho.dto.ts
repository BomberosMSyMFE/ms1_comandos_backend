import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
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

  @ApiPropertyOptional({ example: 'URBANO_ESTRUCTURAL', description: 'Tipo o clasificación del incidente' })
  @IsOptional()
  @IsString()
  tipoIncidente?: string;

  @ApiPropertyOptional({ example: 250, description: 'Litros de espumógeno requeridos para el siniestro' })
  @IsOptional()
  @IsNumber()
  litrosEspumogeno?: number;

  @ApiPropertyOptional({ description: 'Materiales o kits solicitados para despacho' })
  @IsOptional()
  @IsArray()
  materiales?: string[];

  @ApiPropertyOptional({ example: 'Av. Cristo Redentor 4to Anillo', description: 'Dirección o referencia del siniestro' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: 'Parque Industrial Mza 12', description: 'Ubicación textual del siniestro' })
  @IsOptional()
  @IsString()
  ubicacion?: string;

  @ApiPropertyOptional({ example: -17.7833, description: 'Latitud GPS del siniestro' })
  @IsOptional()
  @IsNumber()
  latitud?: number;

  @ApiPropertyOptional({ example: -63.1821, description: 'Longitud GPS del siniestro' })
  @IsOptional()
  @IsNumber()
  longitud?: number;

  @ApiPropertyOptional({ example: 'NORTE', description: 'Zona o cuadrante táctico operativo' })
  @IsOptional()
  @IsString()
  cuadrante?: string;
}
