import { ApiProperty } from '@nestjs/swagger';
import { UsuarioResponseDto } from './usuario-response.dto';

export { UsuarioResponseDto };

export class UsuarioInfoDto extends UsuarioResponseDto {}

export class LoginResponseDto {
  @ApiProperty({ example: 'Autenticación exitosa. Sesión SSO iniciada.' })
  mensaje: string;

  @ApiProperty({ type: UsuarioResponseDto })
  usuario: UsuarioResponseDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT generado (también fijado en cookie HttpOnly)' })
  token: string;
}

