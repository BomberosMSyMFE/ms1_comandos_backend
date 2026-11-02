import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginSsoUseCase } from '../../application/use-cases/login-sso.use-case';
import { LoginRequestDto } from '../../application/dtos/auth/login-request.dto';
import { LoginResponseDto } from '../../application/dtos/auth/login-response.dto';
import { JwtCookieAuthGuard } from '../security/guards/jwt-cookie-auth.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { EnvConfig } from '../config/env.config';

@ApiTags('Autenticación & SSO')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly loginSsoUseCase: LoginSsoUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar Sesión Único (SSO)',
    description: 'Valida credenciales, emite JWT en cookie HttpOnly (SameSite=Strict) y retorna el perfil de usuario.',
  })
  @ApiResponse({ status: 200, description: 'Sesión iniciada con éxito', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.loginSsoUseCase.execute(dto);

    // Inyecta la cookie segura HttpOnly
    response.cookie(EnvConfig.cookieName, result.token, {
      httpOnly: true,
      secure: EnvConfig.cookieSecure,
      sameSite: EnvConfig.cookieSameSite,
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
      path: '/',
    });

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtCookieAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar Sesión', description: 'Invalida y elimina la cookie HttpOnly de la sesión SSO.' })
  @ApiResponse({ status: 200, description: 'Cookie eliminada con éxito' })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(EnvConfig.cookieName, { path: '/' });
    return { mensaje: 'Sesión cerrada exitosamente.' };
  }

  @Get('me')
  @UseGuards(JwtCookieAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener Usuario Actual', description: 'Retorna los datos del usuario autenticado en la sesión.' })
  @ApiResponse({ status: 200, description: 'Perfil de usuario obtenido' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getPerfil(@CurrentUser() user: any) {
    return {
      usuarioId: user.id,
      email: user.email,
      rol: user.rol,
    };
  }
}
