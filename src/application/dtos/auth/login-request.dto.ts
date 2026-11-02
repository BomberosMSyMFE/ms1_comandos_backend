import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ example: 'nataly.comandos@bomberos.gob.bo', description: 'Correo electrónico institucional' })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  email: string;

  @ApiProperty({ example: 'Comandos2026!', description: 'Contraseña del usuario' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
