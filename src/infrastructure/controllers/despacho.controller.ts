import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { DespacharEmergenciaUseCase } from '../../application/use-cases/despachar-emergencia.use-case';
import { ISagaLogRepository } from '../../domain/repositories/saga-log.repository.interface';
import { IniciarDespachoDto } from '../../application/dtos/despacho/iniciar-despacho.dto';
import { ResultadoDespachoDto } from '../../application/dtos/despacho/resultado-despacho.dto';
import { JwtCookieAuthGuard } from '../security/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { Roles } from '../security/decorators/roles.decorator';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { RolUsuario } from '../../domain/value-objects/rol-usuario.vo';

@ApiTags('Despacho Táctico (SAGA)')
@Controller('api/v1/despacho')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DespachoController {
  constructor(
    private readonly despacharEmergenciaUseCase: DespacharEmergenciaUseCase,
    private readonly sagaLogRepo: ISagaLogRepository,
  ) {}

  @Post('iniciar')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Iniciar Despacho Táctico (Patrón SAGA)',
    description:
      'Orquesta la reserva del camión en MS-02 y los insumos en MS-03. ' +
      'Si ocurre un fallo en inventario, ejecuta automáticamente el rollback compensatorio liberando el camión.',
  })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    required: false,
    description: 'Clave única UUID para asegurar la idempotencia del comando de despacho.',
  })
  @ApiResponse({ status: 200, description: 'Despacho completado con éxito', type: ResultadoDespachoDto })
  @ApiResponse({ status: 409, description: 'Compensación ejecutada por fallo en inventario o flotas' })
  async iniciarDespacho(
    @Body() dto: IniciarDespachoDto,
    @CurrentUser('id') operadorId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Res() res: Response,
  ) {
    const resultado = await this.despacharEmergenciaUseCase.execute(dto, operadorId, idempotencyKey);

    if (resultado.status === 'COMPENSACION_EJECUTADA') {
      return res.status(HttpStatus.CONFLICT).json(resultado);
    }

    return res.status(HttpStatus.OK).json(resultado);
  }

  @Get(':sagaId/auditoria')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Consultar Trazabilidad de la Transacción SAGA',
    description: 'Retorna todos los pasos y compensaciones registradas en la bitácora de DynamoDB.',
  })
  @ApiResponse({ status: 200, description: 'Bitácora de eventos SAGA' })
  async obtenerAuditoriaSaga(@Param('sagaId') sagaId: string) {
    return this.sagaLogRepo.buscarPorSagaId(sagaId);
  }
}
