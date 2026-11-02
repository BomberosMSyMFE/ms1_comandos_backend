import { DespacharEmergenciaUseCase } from './despachar-emergencia.use-case';
import { IncidenteEmergencia } from '../../domain/entities/incidente-emergencia.entity';
import { CoordenadaGPS } from '../../domain/value-objects/coordenada-gps.vo';
import { EstadoIncidente } from '../../domain/value-objects/estado-incidente.vo';
import { NivelSeveridad } from '../../domain/value-objects/nivel-severidad.vo';

describe('DespacharEmergenciaUseCase (Patrón SAGA Orquestado)', () => {
  let useCase: DespacharEmergenciaUseCase;
  let mockIncidenteRepo: any;
  let mockDespachoRepo: any;
  let mockHistorialRepo: any;
  let mockSagaLogRepo: any;
  let mockFlotasClient: any;
  let mockInventarioClient: any;
  let mockEventNotifier: any;

  let incidentePendiente: IncidenteEmergencia;

  beforeEach(() => {
    incidentePendiente = new IncidenteEmergencia(
      'inc-001',
      'INC-2026-001',
      'QUIMICO',
      NivelSeveridad.CRITICA,
      'Incendio industrial',
      new CoordenadaGPS(-17.7654, -63.1432),
      'operador-1',
      EstadoIncidente.PENDIENTE,
    );

    mockIncidenteRepo = {
      buscarPorId: jest.fn().mockResolvedValue(incidentePendiente),
      guardar: jest.fn().mockResolvedValue(undefined),
    };

    mockDespachoRepo = {
      guardar: jest.fn().mockResolvedValue(undefined),
    };

    mockHistorialRepo = {
      guardar: jest.fn().mockResolvedValue(undefined),
    };

    mockSagaLogRepo = {
      registrarPaso: jest.fn().mockResolvedValue(undefined),
      buscarPorIdempotencyKey: jest.fn().mockResolvedValue(null),
    };

    mockFlotasClient = {
      reservarCamion: jest.fn().mockResolvedValue({
        exito: true,
        camionId: 'CAM-B04',
        tiempoLlegadaMinutos: 6.0,
      }),
      liberarCamion: jest.fn().mockResolvedValue({ exito: true }),
    };

    mockInventarioClient = {
      reservarInsumos: jest.fn().mockResolvedValue({
        exito: true,
        reservaId: 'res-101',
      }),
      liberarInsumos: jest.fn().mockResolvedValue({ exito: true }),
    };

    mockEventNotifier = {
      notificarIncidenteDespachado: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DespacharEmergenciaUseCase(
      mockIncidenteRepo,
      mockDespachoRepo,
      mockHistorialRepo,
      mockSagaLogRepo,
      mockFlotasClient,
      mockInventarioClient,
      mockEventNotifier,
    );
  });

  it('debe ejecutar el camino feliz del SAGA con éxito', async () => {
    const dto = {
      incidenteId: 'inc-001',
      camionId: 'CAM-B04',
      insumosRequeridos: [{ insumoId: 'INS-ESPUMA', cantidad: 200 }],
    };

    const resultado = await useCase.execute(dto, 'operador-1');

    expect(resultado.status).toBe('EXITO');
    expect(resultado.datos?.estadoActual).toBe(EstadoIncidente.DESPACHADO);
    expect(resultado.datos?.camionAsignado).toBe('CAM-B04');
    expect(mockFlotasClient.reservarCamion).toHaveBeenCalled();
    expect(mockInventarioClient.reservarInsumos).toHaveBeenCalled();
    expect(mockDespachoRepo.guardar).toHaveBeenCalled();
    expect(mockEventNotifier.notificarIncidenteDespachado).toHaveBeenCalled();
  });

  it('debe ejecutar ROLLBACK COMPENSATORIO si MS-03 Inventario falla', async () => {
    // Simulamos fallo en inventario por falta de stock
    mockInventarioClient.reservarInsumos.mockResolvedValueOnce({
      exito: false,
      error: 'Stock de espumógeno químico insuficiente.',
    });

    const dto = {
      incidenteId: 'inc-001',
      camionId: 'CAM-B04',
      insumosRequeridos: [{ insumoId: 'INS-ESPUMA', cantidad: 5000 }],
    };

    const resultado = await useCase.execute(dto, 'operador-1');

    // Comprobamos que el resultado refleja la compensación
    expect(resultado.status).toBe('COMPENSACION_EJECUTADA');
    expect(resultado.codigoError).toBe('STOCK_INSUFICIENTE_INVENTARIO');
    // COMPENSACIÓN: Se debe llamar a liberarCamion para revertir la reserva en MS-02
    expect(mockFlotasClient.liberarCamion).toHaveBeenCalledWith('inc-001', 'CAM-B04');
    // El incidente no debe quedar despachado, debe revertirse a PENDIENTE
    expect(resultado.incidenteEstado).toBe(EstadoIncidente.PENDIENTE);
  });

  it('debe respetar la clave de idempotencia y evitar despachos duplicados', async () => {
    mockSagaLogRepo.buscarPorIdempotencyKey.mockResolvedValueOnce({
      sagaId: 'saga-previa-123',
      incidenteId: 'inc-001',
      estadoSaga: 'COMPLETADA',
      payloadRollback: { camionId: 'CAM-B04' },
    });

    const dto = { incidenteId: 'inc-001', camionId: 'CAM-B04' };
    const resultado = await useCase.execute(dto, 'operador-1', 'idempotency-key-abc');

    expect(resultado.status).toBe('EXITO');
    expect(resultado.mensaje).toContain('Idempotencia activa');
    // No debe llamar a los servicios externos de nuevo
    expect(mockFlotasClient.reservarCamion).not.toHaveBeenCalled();
  });
});
