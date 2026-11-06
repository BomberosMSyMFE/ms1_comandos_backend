import { ObtenerKpisTacticosUseCase } from './obtener-kpis-tacticos.use-case';
import { IncidenteEmergencia } from '../../domain/entities/incidente-emergencia.entity';
import { CoordenadaGPS } from '../../domain/value-objects/coordenada-gps.vo';
import { EstadoIncidente } from '../../domain/value-objects/estado-incidente.vo';
import { NivelSeveridad } from '../../domain/value-objects/nivel-severidad.vo';

describe('ObtenerKpisTacticosUseCase', () => {
  let useCase: ObtenerKpisTacticosUseCase;
  let mockIncidenteRepo: any;

  const mockIncidentes = [
    new IncidenteEmergencia(
      'inc-1',
      'INC-001',
      'ESTRUCTURAL',
      NivelSeveridad.ALTA,
      'Fuego activo en depósito',
      new CoordenadaGPS(-17.78, -63.18, 'Av. Banzer 4to Anillo'),
      'usr-op-1',
      EstadoIncidente.EN_COMBATE,
      2,
    ),
    new IncidenteEmergencia(
      'inc-2',
      'INC-002',
      'FORESTAL',
      NivelSeveridad.CRITICA,
      'Pastizal ardiendo cerca a viviendas',
      new CoordenadaGPS(-17.79, -63.17, 'Santos Dumont 5to Anillo'),
      'usr-op-1',
      EstadoIncidente.DESPACHADO,
      1,
    ),
    new IncidenteEmergencia(
      'inc-3',
      'INC-003',
      'QUIMICO',
      NivelSeveridad.MEDIA,
      'Alarma de derrame',
      new CoordenadaGPS(-17.76, -63.14, 'Parque Industrial'),
      'usr-op-1',
      EstadoIncidente.PENDIENTE,
      0,
    ),
    new IncidenteEmergencia(
      'inc-4',
      'INC-004',
      'VEHICULAR',
      NivelSeveridad.BAJA,
      'Accidente controlado',
      new CoordenadaGPS(-17.81, -63.19, 'Doble Vía a La Guardia'),
      'usr-op-1',
      EstadoIncidente.CONTROLADO,
      1,
    ),
    new IncidenteEmergencia(
      'inc-5',
      'INC-005',
      'ESTRUCTURAL',
      NivelSeveridad.MEDIA,
      'Incendio sofocado',
      new CoordenadaGPS(-17.75, -63.15, 'Cristo Redentor 3er Anillo'),
      'usr-op-1',
      EstadoIncidente.LIQUIDADO,
      1,
    ),
    new IncidenteEmergencia(
      'inc-6',
      'INC-006',
      'ESTRUCTURAL',
      NivelSeveridad.BAJA,
      'Incendio cerrado administrativamente',
      new CoordenadaGPS(-17.77, -63.16, 'Radial 10'),
      'usr-op-1',
      EstadoIncidente.CERRADO,
      1,
    ),
  ];

  beforeEach(() => {
    mockIncidenteRepo = {
      listarTodos: jest.fn().mockResolvedValue(mockIncidentes),
    };
    useCase = new ObtenerKpisTacticosUseCase(mockIncidenteRepo);
  });

  it('debe calcular correctamente los KPIs tácticos excluyendo CERRADO, CONTROLADO y LIQUIDADO de activos', async () => {
    const kpis = await useCase.execute();

    // Activos: inc-1 (EN_COMBATE), inc-2 (DESPACHADO), inc-3 (PENDIENTE) => 3
    expect(kpis.incidentesActivos).toBe(3);

    // Camiones en combate: inc-1 (2 unidades) + inc-2 (1 unidad) => 3
    expect(kpis.camionesEnCombate).toBe(3);

    // Hidrantes operativos: base operativa 43
    expect(kpis.hidrantesOperativos).toBe(43);

    // Litros de agua: 3 camiones * 10,000L + 45,000L = 75,000L
    expect(kpis.litrosAguaDisponibles).toBe(75000);
  });
});
