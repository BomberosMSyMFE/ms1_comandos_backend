import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NivelSeveridad } from '../../../domain/value-objects/nivel-severidad.vo';

export class CrearIncidenteDto {
  @ApiProperty({ example: 'QUIMICO', enum: ['ESTRUCTURAL', 'FORESTAL', 'QUIMICO', 'RESCATE', 'VEHICULAR'] })
  @IsNotEmpty()
  @IsString()
  tipoIncidente: 'ESTRUCTURAL' | 'FORESTAL' | 'QUIMICO' | 'RESCATE' | 'VEHICULAR';

  @ApiProperty({ example: 'CRITICA', enum: NivelSeveridad })
  @IsEnum(NivelSeveridad)
  severidad: NivelSeveridad;

  @ApiProperty({ example: 'Derrame de solvente industrial con combustión activa en galpón 4.' })
  @IsNotEmpty()
  @IsString()
  descripcion: string;

  @ApiProperty({ example: -17.7654, description: 'Latitud GPS' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud: number;

  @ApiProperty({ example: -63.1432, description: 'Longitud GPS' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud: number;

  @ApiPropertyOptional({ example: 'Parque Industrial PI-27, Santa Cruz' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: 'Cuadrante Norte' })
  @IsOptional()
  @IsString()
  zonaCuadrante?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  denuncianteNombre?: string;

  @ApiPropertyOptional({ example: '+591 70012345' })
  @IsOptional()
  @IsString()
  denuncianteTelefono?: string;
}
