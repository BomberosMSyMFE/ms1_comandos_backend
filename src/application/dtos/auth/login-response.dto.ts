import { ApiProperty } from '@nestjs/swagger';

export class UsuarioInfoDto {
  @ApiProperty({ example: 'usr_0192e3a4-8f12-789a-bcde-000000000001' })
  id: string;

  @ApiProperty({ example: 'Nataly Martínez' })
  nombreCompleto: string;

  @ApiProperty({ example: 'nataly.comandos@bomberos.gob.bo' })
  email: string;

  @ApiProperty({ example: 'OPERADOR', enum: ['OPERADOR', 'BOMBERO', 'ADMINISTRADOR'] })
  rol: string;

  @ApiProperty({ example: 'Estación Central - Santa Cruz' })
  estacionBase: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'Autenticación exitosa. Cookie de sesión emitida.' })
  mensaje: string;

  @ApiProperty({ type: UsuarioInfoDto })
  usuario: UsuarioInfoDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT generado (también fijado en cookie HttpOnly)' })
  token: string;
}
