import { v7 as uuidv7 } from 'uuid';
import { IIncidenteRepository } from '../../domain/repositories/incidente.repository.interface';
import { IDespachoRepository } from '../../domain/repositories/despacho.repository.interface';
import { IHistorialRepository } from '../../domain/repositories/historial.repository.interface';
import { ISagaLogRepository } from '../../domain/repositories/saga-log.repository.interface';
import { IFlotasClientPort } from '../ports/flotas-client.port';
import { IInventarioClientPort } from '../ports/inventario-client.port';
import { IEventNotifierPort } from '../ports/event-notifier.port';
import { IAppLoggerPort } from '../ports/logger.port';
import { IniciarDespachoDto } from '../dtos/despacho/iniciar-despacho.dto';
import { ResultadoDespachoDto } from '../dtos/despacho/resultado-despacho.dto';
import { IncidenteNoEncontradoException } from '../../domain/exceptions/incidente-no-encontrado.exception';
import { DespachoTactico } from '../../domain/entities/despacho-tactico.entity';
import { HistorialIncidente } from '../../domain/entities/historial-incidente.entity';

export class DespacharEmergenciaUseCase {
  constructor(
    private readonly incidenteRepo: IIncidenteRepository,
    private readonly despachoRepo: IDespachoRepository,
    private readonly historialRepo: IHistorialRepository,
    private readonly sagaLogRepo: ISagaLogRepository,
    private readonly flotasClient: IFlotasClientPort,
    private readonly inventarioClient: IInventarioClientPort,
    private readonly eventNotifier: IEventNotifierPort,
    private readonly logger?: IAppLoggerPort,
  ) {}

  async execute(
    dto: IniciarDespachoDto,
    operadorId: string,
    idempotencyKey?: string,
  ): Promise<ResultadoDespachoDto> {
    const sagaId = `saga_${uuidv7()}`;

    this.logger?.log(
      'SAGA-ORCHESTRATOR',
      `[INICIO] Despacho táctico iniciado | SagaId: ${sagaId} | Incidente: ${dto.incidenteId} | Operador: ${operadorId} | IdempotencyKey: ${idempotencyKey || 'NINGUNA'}`,
      { sagaId, incidenteId: dto.incidenteId, operadorId, idempotencyKey },
    );

    // 1. Verificación de Idempotencia para evitar dobles despachos
    if (idempotencyKey) {
      const previo = await this.sagaLogRepo.buscarPorIdempotencyKey(idempotencyKey);
      if (previo && previo.estadoSaga === 'COMPLETADA') {
        this.logger?.log(
          'SAGA-ORCHESTRATOR',
          `[IDEMPOTENCIA] Petición duplicada identificada con key '${idempotencyKey}'. Retornando resultado ya consolidado.`,
          { sagaId: previo.sagaId, idempotencyKey },
        );
        return {
          status: 'EXITO',
          sagaId: previo.sagaId,
          mensaje: 'Petición ya procesada con anterioridad (Idempotencia activa).',
          datos: {
            incidenteId: previo.incidenteId,
            estadoActual: 'DESPACHADO',
            camionAsignado: previo.payloadRollback?.camionId || 'CAM-ASIGNADO',
            tiempoEstimadoArriboMinutos: 5.0,
            despachoId: 'desp_existente',
          },
        };
      }
    }

    // 2. Cargar Incidente y validar reglas puras del Dominio
    const incidente = await this.incidenteRepo.buscarPorId(dto.incidenteId);
    if (!incidente) {
      this.logger?.error(
        'SAGA-ORCHESTRATOR',
        `[PASO_0_ERROR] Incidente '${dto.incidenteId}' no encontrado en DynamoDB.`,
        undefined,
        { sagaId, incidenteId: dto.incidenteId },
      );
      throw new IncidenteNoEncontradoException(dto.incidenteId);
    }

    const estadoPrevio = incidente.estado;
    const unidadesPrevias = incidente.unidadesAsignadas;
    const camionTentativo = dto.camionId || 'AUTO_ASIGNACION';

    // Valida que el incidente pueda ser despachado (lanzará EstadoInvalidoException si ya está controlado o cerrado)
    incidente.validarDespacho(camionTentativo);

    this.logger?.log(
      'SAGA-ORCHESTRATOR',
      `[PASO_0_DOMINIO] Invariantes de dominio aprobadas para incidente '${incidente.id}' | Código: ${incidente.codigoRadial} | Estado: ${incidente.estado} | Severidad: ${incidente.severidad}`,
      { sagaId, incidenteId: incidente.id, severidad: incidente.severidad },
    );

    await this.sagaLogRepo.registrarPaso({
      sagaId,
      timestamp: Date.now(),
      incidenteId: incidente.codigoRadial || incidente.id,
      incidenteCodigo: incidente.codigoRadial || incidente.id,
      estadoSaga: 'INICIADA',
      pasoActual: 'PASO_0_VALIDACION_DOMINIO',
      idempotencyKey,
    });

    // 3. PASO 1 SAGA: Reservar Camión en MS-02 Flotas (Spring Boot / PostGIS)
    const latitudIncidente = dto.latitud ?? incidente.ubicacion?.latitud ?? (incidente.ubicacion as any)?.lat ?? -17.7833;
    const longitudIncidente = dto.longitud ?? incidente.ubicacion?.longitud ?? (incidente.ubicacion as any)?.lng ?? -63.1821;
    const direccionIncidente = dto.direccion || dto.ubicacion || incidente.ubicacion?.direccion || (incidente.ubicacion as any)?.dir || incidente.descripcion || 'Santa Cruz de la Sierra';
    const cuadranteIncidente = dto.cuadrante || incidente.ubicacion?.zonaCuadrante || (incidente.ubicacion as any)?.zona_cuadrante || 'CENTRO';

    this.logger?.log(
      'SAGA-ORCHESTRATOR',
      `[PASO_1_FLOTAS] Solicitando reserva de unidad a MS-02 Flotas... | Camión solicitado: ${dto.camionId || 'AUTO_ASIGNACION'}`,
      { sagaId, incidenteId: incidente.id, camionId: dto.camionId, direccion: direccionIncidente, cuadrante: cuadranteIncidente },
    );

    const flotasRes = await this.flotasClient.reservarCamion(
      incidente.id,
      incidente.tipoIncidente,
      {
        camionId: dto.camionId,
        latitud: latitudIncidente,
        longitud: longitudIncidente,
        direccion: direccionIncidente,
        ubicacion: direccionIncidente,
        cuadrante: cuadranteIncidente,
        litrosMinimos: dto.camionId && dto.camionId !== 'AUTO_ASIGNACION' ? 0 : (incidente.severidad === 'CRITICA' ? 8000 : 3000),
      },
    );

    if (!flotasRes.exito) {
      incidente.restaurarEstado(estadoPrevio, unidadesPrevias);
      this.logger?.warn(
        'SAGA-ORCHESTRATOR',
        `[PASO_1_FALLO] MS-02 Flotas no pudo reservar unidad: ${flotasRes.error || 'Sin disponibilidad'}`,
        { sagaId, incidenteId: incidente.id, error: flotasRes.error },
      );

      await this.sagaLogRepo.registrarPaso({
        sagaId,
        timestamp: Date.now(),
        incidenteId: incidente.codigoRadial || incidente.id,
        incidenteCodigo: incidente.codigoRadial || incidente.id,
        estadoSaga: 'FALLO_PASO_1',
        pasoActual: 'PASO_1_FLOTAS',
        detalleError: flotasRes.error || 'No hay camiones disponibles en el radio operativo.',
        payloadRollback: { camionId: dto.camionId || 'AUTO_ASIGNACION' },
        idempotencyKey,
      });

      return {
        status: 'COMPENSACION_EJECUTADA',
        sagaId,
        codigoError: 'FALLO_RESERVA_FLOTAS',
        mensaje: flotasRes.error || 'No fue posible asignar una unidad de bomberos disponible.',
        incidenteEstado: incidente.estado,
      };
    }

    this.logger?.log(
      'SAGA-ORCHESTRATOR',
      `[PASO_1_OK] Unidad asignada con éxito por MS-02 Flotas: '${flotasRes.camionId}' | ETA: ${flotasRes.tiempoLlegadaMinutos} min | Distancia: ${flotasRes.distanciaKms || 'N/D'} km`,
      { sagaId, camionId: flotasRes.camionId, etaMinutos: flotasRes.tiempoLlegadaMinutos },
    );

    await this.sagaLogRepo.registrarPaso({
      sagaId,
      timestamp: Date.now(),
      incidenteId: incidente.codigoRadial || incidente.id,
      incidenteCodigo: incidente.codigoRadial || incidente.id,
      estadoSaga: 'RESERVA_CAMION_OK',
      pasoActual: 'PASO_1_FLOTAS',
      payloadRollback: { camionId: flotasRes.camionId },
      idempotencyKey,
    });

    // 4. PASO 2 SAGA: Reservar Insumos en MS-03 Inventario (Laravel / PostgreSQL GraphQL)
    const insumosAAsignar = dto.insumosRequeridos || [];
    const itemEspuma = insumosAAsignar.find(
      (i) => i.insumoId.toLowerCase().includes('espuma') || i.insumoId.toLowerCase().includes('afff'),
    );
    const litrosEspuma = dto.litrosEspumogeno || (itemEspuma ? itemEspuma.cantidad : 250.0);

    this.logger?.log(
      'SAGA-ORCHESTRATOR',
      `[PASO_2_INVENTARIO] Solicitando reserva de insumos a MS-03 Inventario... | Insumos: ${insumosAAsignar.length} ítems | Espumógeno: ${litrosEspuma} L`,
      { sagaId, camionId: flotasRes.camionId, itemsCount: insumosAAsignar.length, litrosEspuma },
    );

    const inventarioRes = await this.inventarioClient.reservarInsumos(
      incidente.id,
      flotasRes.camionId,
      insumosAAsignar,
      litrosEspuma,
    );

    // Si Inventario falla -> DISPARAR ROLLBACK COMPENSATORIO HACIA FLOTAS
    if (!inventarioRes.exito) {
      this.logger?.warn(
        'SAGA-ORCHESTRATOR',
        `[PASO_2_FALLO] MS-03 Inventario rechazó reserva: ${inventarioRes.error || 'Stock insuficiente'}. INICIANDO ROLLBACK COMPENSATORIO HACIA MS-02 FLOTAS.`,
        { sagaId, error: inventarioRes.error, camionARevertir: flotasRes.camionId },
      );

      // Acción Compensatoria 1: Liberar el camión en MS-02 con motivo tipado
      await this.flotasClient.liberarCamion(
        incidente.id,
        flotasRes.camionId,
        `INVENTARIO_RECHAZO_${inventarioRes.error || 'FALTA_STOCK'}`,
      );

      // Acción Compensatoria 2: Asegurar que el estado del incidente permanezca intacto
      incidente.restaurarEstado(estadoPrevio, unidadesPrevias);
      await this.incidenteRepo.guardar(incidente);

      this.logger?.warn(
        'SAGA-ORCHESTRATOR',
        `[ROLLBACK_COMPENSADO] Unidad '${flotasRes.camionId}' liberada en MS-02 Flotas. Estado de incidente '${incidente.id}' restaurado a '${estadoPrevio}'.`,
        { sagaId, incidenteId: incidente.id, camionLiberado: flotasRes.camionId, estadoRestaurado: incidente.estado },
      );

      await this.sagaLogRepo.registrarPaso({
        sagaId,
        timestamp: Date.now(),
        incidenteId: incidente.codigoRadial || incidente.id,
        incidenteCodigo: incidente.codigoRadial || incidente.id,
        estadoSaga: 'COMPENSADA',
        pasoActual: 'PASO_2_INVENTARIO_ROLLBACK',
        detalleError: inventarioRes.error || 'Stock crítico insuficiente en almacén central.',
        payloadRollback: { camionLiberado: flotasRes.camionId },
        idempotencyKey,
      });

      return {
        status: 'COMPENSACION_EJECUTADA',
        sagaId,
        codigoError: 'STOCK_INSUFICIENTE_INVENTARIO',
        mensaje: `Fallo en inventario: ${inventarioRes.error || 'Stock insuficiente'}. Se ejecutó el rollback liberando la unidad ${flotasRes.camionId}.`,
        incidenteEstado: incidente.estado,
      };
    }

    this.logger?.log(
      'SAGA-ORCHESTRATOR',
      `[PASO_2_OK] Insumos reservados exitosamente en MS-03 Inventario (Tx: ${inventarioRes.transaccionId || 'TX-OK'}). Consolidando transacciones locales...`,
      { sagaId, transaccionId: inventarioRes.transaccionId },
    );

    // 5. CAMINO FELIZ (Transacciones locales consolidadas tras éxito en Flotas e Inventario)
    incidente.despachar(flotasRes.camionId);
    await this.incidenteRepo.guardar(incidente);

    const despachoId = `desp_${uuidv7()}`;
    const nuevoDespacho = new DespachoTactico(
      despachoId,
      incidente.id,
      flotasRes.camionId,
      dto.conductorId || 'BOMBERO_GUARDIA',
      operadorId,
      insumosAAsignar.map((i) => ({
        insumoId: i.insumoId,
        nombre: i.insumoId,
        cantidad: i.cantidad,
      })),
      new Date().toISOString(),
      'EN_RUTA',
    );
    await this.despachoRepo.guardar(nuevoDespacho);

    const novedadHistorial = HistorialIncidente.registrar(
      incidente.id,
      incidente.estado,
      operadorId,
      `Unidad '${flotasRes.camionId}' despachada hacia la escena con tiempo estimado de ${flotasRes.tiempoLlegadaMinutos} minutos.`,
      estadoPrevio,
    );
    await this.historialRepo.guardar(novedadHistorial);

    await this.sagaLogRepo.registrarPaso({
      sagaId,
      timestamp: Date.now(),
      incidenteId: incidente.codigoRadial || incidente.id,
      incidenteCodigo: incidente.codigoRadial || incidente.id,
      estadoSaga: 'COMPLETADA',
      pasoActual: 'PASO_FINAL_CONSOLIDACION',
      payloadRollback: { camionId: flotasRes.camionId, despachoId },
      idempotencyKey,
    });

    // Notificar despacho táctico a MS-02 Flotas de forma asíncrona
    if (this.flotasClient.notificarDespacho) {
      this.flotasClient.notificarDespacho({
        unidadId: flotasRes.camionId,
        incidenteId: incidente.codigoRadial || incidente.id,
        tipoIncidente: incidente.tipoIncidente,
        ubicacion: direccionIncidente,
        latitud: latitudIncidente,
        longitud: longitudIncidente,
        prioridad: incidente.severidad === 'CRITICA' ? 'ALTA' : 'MEDIA',
      }).catch((err: any) => {
        this.logger?.warn('SAGA-ORCHESTRATOR', `Fallo al notificar despacho a Flotas: ${err.message}`);
      });
    }

    // 6. Notificar por WebSockets a toda la Sala de Crisis en tiempo real
    const datosRespuesta = {
      incidenteId: incidente.id,
      estadoActual: incidente.estado,
      camionAsignado: flotasRes.camionId,
      tiempoEstimadoArriboMinutos: flotasRes.tiempoLlegadaMinutos,
      despachoId,
    };

    await this.eventNotifier.notificarIncidenteDespachado({
      ...datosRespuesta,
      sagaId,
      operadorId,
    });

    this.logger?.log(
      'SAGA-ORCHESTRATOR',
      `[COMPLETADA] SAGA finalizada con éxito. Incidente: ${incidente.id} -> ${incidente.estado} | Unidad: ${flotasRes.camionId} | Despacho: ${despachoId}. Sala de Crisis notificada.`,
      { sagaId, despachoId, camionId: flotasRes.camionId, estado: incidente.estado },
    );

    return {
      status: 'EXITO',
      sagaId,
      mensaje: 'Unidad despachada e insumos reservados con éxito mediante orquestador SAGA.',
      datos: datosRespuesta,
    };
  }
}
