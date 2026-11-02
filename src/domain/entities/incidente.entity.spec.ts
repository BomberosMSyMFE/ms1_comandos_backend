import { IncidenteEmergencia } from './incidente-emergencia.entity';
import { CoordenadaGPS } from '../value-objects/coordenada-gps.vo';
import { EstadoIncidente } from '../value-objects/estado-incidente.vo';
import { NivelSeveridad } from '../value-objects/nivel-severidad.vo';
import { EstadoInvalidoException } from '../exceptions/estado-invalido.exception';

describe('IncidenteEmergencia (Reglas Críticas del Negocio)', () => {
  const ubicacionValida = new CoordenadaGPS(-17.7654, -63.1432, 'Parque Industrial PI-27');

  it('debe crear un incidente en estado PENDIENTE con 0 unidades asignadas', () => {
    const incidente = new IncidenteEmergencia(
      'inc-01',
      'INC-2026-001',
      'QUIMICO',
      NivelSeveridad.CRITICA,
      'Fuga de amoniaco',
      ubicacionValida,
      'operador-1',
    );

    expect(incidente.estado).toBe(EstadoIncidente.PENDIENTE);
    expect(incidente.unidadesAsignadas).toBe(0);
  });

  it('debe transicionar a DESPACHADO e incrementar unidades asignadas', () => {
    const incidente = new IncidenteEmergencia(
      'inc-01',
      'INC-2026-001',
      'QUIMICO',
      NivelSeveridad.CRITICA,
      'Fuga de amoniaco',
      ubicacionValida,
      'operador-1',
    );

    incidente.despachar('CAM-B04');
    expect(incidente.estado).toBe(EstadoIncidente.DESPACHADO);
    expect(incidente.unidadesAsignadas).toBe(1);
  });

  it('debe lanzar EstadoInvalidoException si se intenta cerrar un incidente no controlado', () => {
    const incidente = new IncidenteEmergencia(
      'inc-01',
      'INC-2026-001',
      'ESTRUCTURAL',
      NivelSeveridad.ALTA,
      'Fuego activo',
      ubicacionValida,
      'operador-1',
      EstadoIncidente.PENDIENTE,
    );

    expect(() => incidente.cerrar()).toThrow(EstadoInvalidoException);
  });

  it('debe permitir cerrar el incidente si ya está en estado CONTROLADO', () => {
    const incidente = new IncidenteEmergencia(
      'inc-01',
      'INC-2026-001',
      'ESTRUCTURAL',
      NivelSeveridad.ALTA,
      'Fuego activo',
      ubicacionValida,
      'operador-1',
      EstadoIncidente.CONTROLADO,
    );

    incidente.cerrar();
    expect(incidente.estado).toBe(EstadoIncidente.CERRADO);
  });
});
