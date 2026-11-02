import { v7 as uuidv7 } from 'uuid';
import { IIncidenteRepository } from '../../domain/repositories/incidente.repository.interface';
import { IDespachoRepository } from '../../domain/repositories/despacho.repository.interface';
import { IHistorialRepository } from '../../domain/repositories/historial.repository.interface';
import { ISagaLogRepository } from '../../domain/repositories/saga-log.repository.interface';
import { IFlotasClientPort } from '../ports/flotas-client.port';
import { IInventarioClientPort } from '../ports/inventario-client.port';
import { IEventNotifierPort } from '../ports/event-notifier.port';
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
  ) {}

  async execute(
    dto: IniciarDespachoDto,
    operadorId: string,
    idempotencyKey?: string,
  ): Promise<ResultadoDespachoDto> {
    const sagaId = `saga_${uuidv7()}`;

    // 1. Verificación de Idempotencia para evitar dobles despachos
    if (idempotencyKey) {
      const previo = await this.sagaLogRepo.buscarPorIdempotencyKey(idempotencyKey);
      if (previo && previo.estadoSaga === 'COMPLETADA') {
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
      throw new IncidenteNoEncontradoException(dto.incidenteId);
    }

    const camionTentativo = dto.camionId || 'AUTO_ASIGNACION';
    // Aplica lógica de la entidad pura (lanzará EstadoInvalidoException si ya está controlado o cerrado)
    incidente.despachar(camionTentativo);

    await this.sagaLogRepo.registrarPaso({
      sagaId,
      timestamp: Date.now(),
      incidenteId: incidente.id,
      estadoSaga: 'INICIADA',
      pasoActual: 'PASO_0_VALIDACION_DOMINIO',
      idempotencyKey,
    });

    // 3. PASO 1 SAGA: Reservar Camión en MS-02 Flotas (Spring Boot / PostGIS)
    const flotasRes = await this.flotasClient.reservarCamion(
      incidente.id,
      incidente.tipoIncidente,
      dto.camionId,
    );

    if (!flotasRes.exito) {
      incidente.revertirDespacho();
      await this.sagaLogRepo.registrarPaso({
        sagaId,
        timestamp: Date.now(),
        incidenteId: incidente.id,
        estadoSaga: 'FALLO_PASO_1',
        pasoActual: 'PASO_1_FLOTAS',
        detalleError: flotasRes.error || 'No hay camiones disponibles en el radio operativo.',
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

    await this.sagaLogRepo.registrarPaso({
      sagaId,
      timestamp: Date.now(),
      incidenteId: incidente.id,
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
    const litrosEspuma = itemEspuma ? itemEspuma.cantidad : 250.0;

    const inventarioRes = await this.inventarioClient.reservarInsumos(
      incidente.id,
      flotasRes.camionId,
      insumosAAsignar,
      litrosEspuma,
    );

    // Si Inventario falla -> DISPARAR ROLLBACK COMPENSATORIO HACIA FLOTAS
    if (!inventarioRes.exito) {
      // Acción Compensatoria 1: Liberar el camión en MS-02
      await this.flotasClient.liberarCamion(incidente.id, flotasRes.camionId);

      // Acción Compensatoria 2: Revertir estado del incidente
      incidente.revertirDespacho();
      await this.incidenteRepo.guardar(incidente);

      await this.sagaLogRepo.registrarPaso({
        sagaId,
        timestamp: Date.now(),
        incidenteId: incidente.id,
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

    // 5. CAMINO FELIZ (Transacciones locales consolidadas)
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
    );
    await this.historialRepo.guardar(novedadHistorial);

    await this.sagaLogRepo.registrarPaso({
      sagaId,
      timestamp: Date.now(),
      incidenteId: incidente.id,
      estadoSaga: 'COMPLETADA',
      pasoActual: 'PASO_FINAL_CONSOLIDACION',
      payloadRollback: { camionId: flotasRes.camionId, despachoId },
      idempotencyKey,
    });

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

    return {
      status: 'EXITO',
      sagaId,
      mensaje: 'Unidad despachada e insumos reservados con éxito mediante orquestador SAGA.',
      datos: datosRespuesta,
    };
  }
}
