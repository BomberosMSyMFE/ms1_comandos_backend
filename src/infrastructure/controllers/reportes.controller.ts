import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IReporteRepository } from '../../domain/repositories/reporte.repository.interface';
import { JwtCookieAuthGuard } from '../security/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { Roles } from '../security/decorators/roles.decorator';
import { RolUsuario } from '../../domain/value-objects/rol-usuario.vo';

@ApiTags('Reportes Ejecutivos')
@Controller('api/v1/reportes')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportesController {
  constructor(private readonly reporteRepo: IReporteRepository) {}

  @Get()
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Listar Catálogo de Reportes Ejecutivos',
    description: 'Retorna los reportes ejecutivos generados por voz o comando para la Comandancia (CU-07).',
  })
  @ApiResponse({ status: 200, description: 'Lista de reportes' })
  async listar() {
    return this.reporteRepo.listarTodos();
  }

  @Get(':id')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Obtener Detalle de un Reporte',
    description: 'Retorna el resumen analítico y los enlaces para descargar PDF, Excel o Audio síntesis.',
  })
  @ApiResponse({ status: 200, description: 'Detalle del reporte' })
  async obtenerPorId(@Param('id') id: string) {
    return this.reporteRepo.buscarPorId(id);
  }
}
