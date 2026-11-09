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
import { DynamoDbSagaLogRepository } from '../persistence/dynamodb/dynamodb-saga-log.repository';
import { IniciarDespachoDto } from '../../application/dtos/despacho/iniciar-despacho.dto';
import { ResultadoDespachoDto } from '../../application/dtos/despacho/resultado-despacho.dto';
import { JwtCookieAuthGuard } from '../security/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { Roles } from '../security/decorators/roles.decorator';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { RolUsuario } from '../../domain/value-objects/rol-usuario.vo';
import { TacticalLoggerService } from '../logging/tactical-logger.service';

@ApiTags('Despacho Táctico (SAGA)')
@Controller('api/v1/despacho')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DespachoController {
  constructor(
    private readonly despacharEmergenciaUseCase: DespacharEmergenciaUseCase,
    private readonly sagaLogRepo: DynamoDbSagaLogRepository,
    private readonly logger: TacticalLoggerService,
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
    this.logger.log(
      'DESPACHO-CTRL',
      `[POST /iniciar] Comando de despacho táctico recibido para incidente '${dto.incidenteId}'. Operador: '${operadorId}'.`,
      { incidenteId: dto.incidenteId, operadorId, idempotencyKey },
    );

    const resultado = await this.despacharEmergenciaUseCase.execute(dto, operadorId, idempotencyKey);

    if (resultado.status === 'COMPENSACION_EJECUTADA') {
      this.logger.warn(
        'DESPACHO-CTRL',
        `[POST /iniciar -> 409 CONFLICT] Compensación SAGA ejecutada para sagaId '${resultado.sagaId}'. Motivo: ${resultado.codigoError}.`,
        { sagaId: resultado.sagaId, codigoError: resultado.codigoError },
      );
      return res.status(HttpStatus.CONFLICT).json(resultado);
    }

    this.logger.log(
      'DESPACHO-CTRL',
      `[POST /iniciar -> 200 OK] Despacho táctico consolidado con éxito. SagaId: '${resultado.sagaId}', Camión: '${resultado.datos?.camionAsignado}'.`,
      { sagaId: resultado.sagaId, camion: resultado.datos?.camionAsignado },
    );
    return res.status(HttpStatus.OK).json(resultado);
  }

  @Get('historial')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Listar Transacciones SAGA Recientes',
    description: 'Retorna los eventos y compensaciones recientes registrados en DynamoDB.',
  })
  async listarHistorialSaga() {
    return this.sagaLogRepo.listarRecientes(30);
  }

  @Get(':sagaId/auditoria')
  @Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Consultar Trazabilidad de la Transacción SAGA',
    description: 'Retorna todos los pasos y compensaciones registradas en la bitácora de DynamoDB.',
  })
  @ApiResponse({ status: 200, description: 'Bitácora de eventos SAGA' })
  async obtenerAuditoriaSaga(@Param('sagaId') sagaId: string) {
    this.logger.debug?.(
      'DESPACHO-CTRL',
      `[GET /:sagaId/auditoria] Consultando bitácora de SAGA '${sagaId}'.`,
      { sagaId },
    );
    return this.sagaLogRepo.buscarPorSagaId(sagaId);
  }
}

