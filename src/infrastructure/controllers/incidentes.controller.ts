import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RegistrarIncidenteUseCase } from '../../application/use-cases/registrar-incidente.use-case';
import { CambiarEstadoIncidenteUseCase } from '../../application/use-cases/cambiar-estado-incidente.use-case';
import { ListarIncidentesActivosUseCase } from '../../application/use-cases/listar-incidentes-activos.use-case';
import { ObtenerTimelineIncidenteUseCase } from '../../application/use-cases/obtener-timeline-incidente.use-case';
import { ObtenerDespachosIncidenteUseCase } from '../../application/use-cases/obtener-despachos-incidente.use-case';
import { ObtenerKpisTacticosUseCase } from '../../application/use-cases/obtener-kpis-tacticos.use-case';
import { CrearIncidenteDto } from '../../application/dtos/incidente/crear-incidente.dto';
import { CambiarEstadoIncidenteDto } from '../../application/dtos/incidente/cambiar-estado.dto';
import { IncidenteResponseDto } from '../../application/dtos/incidente/incidente-response.dto';
import { KpisTacticosResponseDto } from '../../application/dtos/incidente/kpis-tacticos-response.dto';
import { JwtCookieAuthGuard } from '../security/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { Roles } from '../security/decorators/roles.decorator';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { RolUsuario } from '../../domain/value-objects/rol-usuario.vo';
import { TacticalLoggerService } from '../logging/tactical-logger.service';

@ApiTags('Incidentes & Alertas')
@Controller('api/v1/incidentes')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IncidentesController {
  constructor(
    private readonly registrarIncidenteUseCase: RegistrarIncidenteUseCase,
    private readonly cambiarEstadoIncidenteUseCase: CambiarEstadoIncidenteUseCase,
    private readonly listarIncidentesActivosUseCase: ListarIncidentesActivosUseCase,
    private readonly obtenerKpisTacticosUseCase: ObtenerKpisTacticosUseCase,
    private readonly obtenerTimelineIncidenteUseCase: ObtenerTimelineIncidenteUseCase,
    private readonly obtenerDespachosIncidenteUseCase: ObtenerDespachosIncidenteUseCase,
    private readonly logger: TacticalLoggerService,
  ) {}

  @Get('activos')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Listar Incidentes Activos',
    description: 'Retorna todas las emergencias que no se encuentren en estado CERRADO para la Sala de Crisis.',
  })
  @ApiResponse({ status: 200, type: [IncidenteResponseDto] })
  async listarActivos() {
    const incidentes = await this.listarIncidentesActivosUseCase.execute();
    return incidentes.map((inc) => ({
      id: inc.id,
      codigoRadial: inc.codigoRadial,
      tipoIncidente: inc.tipoIncidente,
      severidad: inc.severidad,
      descripcion: inc.descripcion,
      estado: inc.estado,
      ubicacion: inc.ubicacion.toJSON(),
      unidadesAsignadas: inc.unidadesAsignadas,
      camionAsignado: inc.camionAsignado,
      operadorId: inc.operadorId,
      denunciante: inc.denunciante,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
    }));
  }

  @Get('kpis-tacticos')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Consultar KPIs Tácticos en Vivo',
    description: 'Retorna las métricas clave en tiempo real: incidentes activos, camiones en combate, hidrantes y agua disponible.',
  })
  @ApiResponse({ status: 200, type: KpisTacticosResponseDto })
  async obtenerKpisTacticos(): Promise<KpisTacticosResponseDto> {
    return this.obtenerKpisTacticosUseCase.execute();
  }

  @Get(':id/timeline')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Obtener Línea de Tiempo del Incidente',
    description: 'Retorna la bitácora inmutable de novedades y cambios de estado del incidente.',
  })
  @ApiResponse({ status: 200, description: 'Línea de tiempo cronológica' })
  async obtenerTimeline(@Param('id') id: string) {
    return this.obtenerTimelineIncidenteUseCase.execute(id);
  }

  @Get(':id/despachos')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Listar Unidades Despachadas',
    description: 'Retorna los camiones cisterna y recursos asignados al siniestro.',
  })
  @ApiResponse({ status: 200, description: 'Lista de despachos tácticos' })
  async obtenerDespachos(@Param('id') id: string) {
    return this.obtenerDespachosIncidenteUseCase.execute(id);
  }

  @Post()
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Registrar Nuevo Incidente de Emergencia',
    description: 'Crea una nueva alarma en estado PENDIENTE y emite notificación por WebSockets.',
  })
  @ApiResponse({ status: 201, type: IncidenteResponseDto })
  async registrar(
    @Body() dto: CrearIncidenteDto,
    @CurrentUser('id') operadorId: string,
  ) {
    this.logger.log(
      'INCIDENTES-CTRL',
      `[POST /] Registrando nueva alarma de emergencia | Tipo: ${dto.tipoIncidente} | Severidad: ${dto.severidad} | Operador: ${operadorId}`,
      { tipo: dto.tipoIncidente, severidad: dto.severidad, operadorId },
    );
    const inc = await this.registrarIncidenteUseCase.execute(dto, operadorId);
    this.logger.log(
      'INCIDENTES-CTRL',
      `[POST / -> 201 CREATED] Incidente registrado exitosamente | ID: ${inc.id} | Código: ${inc.codigoRadial} | Estado: ${inc.estado}`,
      { id: inc.id, codigoRadial: inc.codigoRadial },
    );
    return {
      id: inc.id,
      codigoRadial: inc.codigoRadial,
      tipoIncidente: inc.tipoIncidente,
      severidad: inc.severidad,
      descripcion: inc.descripcion,
      estado: inc.estado,
      ubicacion: inc.ubicacion.toJSON(),
      unidadesAsignadas: inc.unidadesAsignadas,
      camionAsignado: inc.camionAsignado,
      operadorId: inc.operadorId,
      denunciante: inc.denunciante,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
    };
  }

  @Patch(':id/estado')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Actualizar Estado del Siniestro',
    description: 'Transiciona el estado (EN_COMBATE, CONTROLADO, CERRADO) y registra una novedad en la bitácora.',
  })
  @ApiResponse({ status: 200, type: IncidenteResponseDto })
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoIncidenteDto,
    @CurrentUser('id') operadorId: string,
  ) {
    this.logger.log(
      'INCIDENTES-CTRL',
      `[PATCH /:id/estado] Transición de estado solicitada para incidente '${id}' -> ${dto.nuevoEstado}. Operador: '${operadorId}'.`,
      { incidenteId: id, nuevoEstado: dto.nuevoEstado, operadorId },
    );
    const inc = await this.cambiarEstadoIncidenteUseCase.execute(id, dto, operadorId);
    this.logger.log(
      'INCIDENTES-CTRL',
      `[PATCH /:id/estado -> 200 OK] Incidente '${id}' actualizado a estado '${inc.estado}'.`,
      { incidenteId: id, estado: inc.estado },
    );
    return {
      id: inc.id,
      codigoRadial: inc.codigoRadial,
      tipoIncidente: inc.tipoIncidente,
      severidad: inc.severidad,
      descripcion: inc.descripcion,
      estado: inc.estado,
      ubicacion: inc.ubicacion.toJSON(),
      unidadesAsignadas: inc.unidadesAsignadas,
      camionAsignado: inc.camionAsignado,
      operadorId: inc.operadorId,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
    };
  }
}
