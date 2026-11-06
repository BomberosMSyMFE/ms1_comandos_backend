import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginSsoUseCase } from '../../application/use-cases/login-sso.use-case';
import { ListarOperadoresUseCase } from '../../application/use-cases/listar-operadores.use-case';
import { LoginRequestDto } from '../../application/dtos/auth/login-request.dto';
import { LoginResponseDto, UsuarioResponseDto } from '../../application/dtos/auth/login-response.dto';
import { JwtCookieAuthGuard } from '../security/guards/jwt-cookie-auth.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { EnvConfig } from '../config/env.config';
import { TacticalLoggerService } from '../logging/tactical-logger.service';
import { CredencialesInvalidasException } from '../../domain/exceptions/credenciales-invalidas.exception';

@ApiTags('Autenticación & SSO')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly loginSsoUseCase: LoginSsoUseCase,
    private readonly listarOperadoresUseCase: ListarOperadoresUseCase,
    private readonly logger: TacticalLoggerService,
  ) {}

  @Get('operadores')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar Operadores Activos para Alertas WhatsApp (n8n)',
    description: 'Devuelve la lista de operadores activos con su teléfono móvil y estación base para el envío de alertas automáticas vía n8n.',
  })
  @ApiResponse({ status: 200, description: 'Lista de operadores activos', type: [UsuarioResponseDto] })
  async listarOperadores(): Promise<UsuarioResponseDto[]> {
    this.logger.log(
      'AUTH-OPERADORES',
      '[GET /operadores] Consulta de operadores activos para integración con n8n/WhatsApp.',
    );
    const operadores = await this.listarOperadoresUseCase.execute();
    return operadores.map((op) => ({
      id: op.id,
      nombreCompleto: op.nombreCompleto,
      email: op.email,
      rol: op.rol,
      estacionBase: op.estacionBase,
      telefonoMovil: op.telefonoMovil,
    }));
  }

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
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    const clientIp = request.ip || request.socket.remoteAddress || '127.0.0.1';
    this.logger.log(
      'AUTH-SSO',
      `[LOGIN_ATTEMPT] Recibida solicitud de autenticación para '${dto.email}' desde IP ${clientIp}.`,
      { email: dto.email, ip: clientIp },
    );

    try {
      const result = await this.loginSsoUseCase.execute(dto);

      // Inyecta la cookie segura HttpOnly
      response.cookie(EnvConfig.cookieName, result.token, {
        httpOnly: true,
        secure: EnvConfig.cookieSecure,
        sameSite: EnvConfig.cookieSameSite,
        maxAge: 8 * 60 * 60 * 1000, // 8 horas
        path: '/',
      });

      this.logger.log(
        'AUTH-AUDIT',
        `[AUTH-AUDIT] Usuario ${result.usuario.email} autenticado exitosamente (Rol: ${result.usuario.rol}). Cookie HttpOnly 'jwt' establecida.`,
        { usuarioId: result.usuario.id, rol: result.usuario.rol, cookieName: EnvConfig.cookieName },
      );

      return result;
    } catch (err: any) {
      this.logger.warn(
        'AUTH-AUDIT',
        `[AUTH-AUDIT WARN] Intento fallido de autenticación para ${dto.email}. Credenciales inválidas.`,
        { email: dto.email, error: err.message },
      );
      if (err instanceof CredencialesInvalidasException) {
        throw new UnauthorizedException(err.message);
      }
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtCookieAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar Sesión', description: 'Invalida y elimina la cookie HttpOnly de la sesión SSO.' })
  @ApiResponse({ status: 200, description: 'Cookie eliminada con éxito' })
  logout(
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user: any,
  ) {
    response.clearCookie(EnvConfig.cookieName, { path: '/' });
    this.logger.log(
      'AUTH-SSO',
      `[LOGOUT] Sesión SSO cerrada y cookie '${EnvConfig.cookieName}' purgada para usuario '${user?.email || 'anónimo'}'.`,
      { usuarioId: user?.id, email: user?.email },
    );
    return { mensaje: 'Sesión cerrada exitosamente.' };
  }

  @Get('me')
  @UseGuards(JwtCookieAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener Usuario Actual', description: 'Retorna los datos del usuario autenticado en la sesión.' })
  @ApiResponse({ status: 200, description: 'Perfil de usuario obtenido' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getPerfil(@CurrentUser() user: any) {
    this.logger.log(
      'AUTH-AUDIT',
      `[AUTH-AUDIT] Sesión HttpOnly validada para usuario ${user.id} (${user.email}).`,
      { usuarioId: user.id, email: user.email, rol: user.rol },
    );
    this.logger.debug?.(
      'AUTH-SSO',
      `[ME] Consulta de perfil activo: '${user.email}' (${user.rol}).`,
      { usuarioId: user.id, email: user.email },
    );
    return {
      usuarioId: user.id,
      email: user.email,
      rol: user.rol,
    };
  }
}
