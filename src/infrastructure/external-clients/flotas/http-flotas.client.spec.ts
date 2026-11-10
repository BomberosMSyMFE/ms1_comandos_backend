import { HttpFlotasClient } from './http-flotas.client';

describe('HttpFlotasClient', () => {
  let client: HttpFlotasClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    client = new HttpFlotasClient();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('reservarCamion', () => {
    it('debe enviar latitud, longitud, direccion, ubicacion y cuadrante a MS-02 Flotas', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          camionId: 'B-04',
          reservaId: 'res-flotas-1',
          tiempoLlegadaMinutos: 4.5,
          placa: 'SCZ-1234',
          capacidadAguaLts: 5000,
        }),
      });
      global.fetch = mockFetch;

      const respuesta = await client.reservarCamion('inc-100', 'ESTRUCTURAL', {
        camionId: 'B-04',
        latitud: -17.7811,
        longitud: -63.1805,
        direccion: 'Calle Sucre #250',
        ubicacion: 'Calle Sucre #250',
        cuadrante: 'CENTRO',
      });

      expect(respuesta.exito).toBe(true);
      expect(respuesta.camionId).toBe('B-04');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/flotas/reservar-camion'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incidenteId: 'inc-100',
            tipoFuego: 'URBANO_ESTRUCTURAL',
            camionId: 'B-04',
            latitud: -17.7811,
            longitud: -63.1805,
            direccion: 'Calle Sucre #250',
            ubicacion: 'Calle Sucre #250',
            cuadrante: 'CENTRO',
            litrosMinimos: 3000,
          }),
        }),
      );
    });

    it('debe usar valores por defecto para coordenadas si no se proveen en opciones', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          camionId: 'B-01',
          tiempoLlegadaMinutos: 5.0,
        }),
      });
      global.fetch = mockFetch;

      const respuesta = await client.reservarCamion('inc-101', 'FORESTAL');

      expect(respuesta.exito).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/flotas/reservar-camion'),
        expect.objectContaining({
          body: expect.stringContaining('"latitud":-17.7833'),
        }),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/flotas/reservar-camion'),
        expect.objectContaining({
          body: expect.stringContaining('"longitud":-63.1821'),
        }),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/flotas/reservar-camion'),
        expect.objectContaining({
          body: expect.stringContaining('"cuadrante":"CENTRO"'),
        }),
      );
    });
  });

  describe('notificarDespacho', () => {
    it('debe invocar POST /api/v1/flotas/despacho-notificar con los parámetros completos', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ mensaje: 'Notificación procesada' }),
      });
      global.fetch = mockFetch;

      const res = await client.notificarDespacho({
        unidadId: 'B-04',
        incidenteId: 'INC-2026-001',
        tipoIncidente: 'INDUSTRIAL',
        ubicacion: 'Av. Banzer 4to Anillo',
        latitud: -17.7500,
        longitud: -63.1700,
        prioridad: 'ALTA',
      });

      expect(res.exito).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/flotas/despacho-notificar'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unidadId: 'B-04',
            incidenteId: 'INC-2026-001',
            tipoIncidente: 'INDUSTRIAL',
            ubicacion: 'Av. Banzer 4to Anillo',
            latitud: -17.7500,
            longitud: -63.1700,
            prioridad: 'ALTA',
          }),
        }),
      );
    });

    it('debe manejar errores HTTP sin lanzar excepciones no controladas', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ mensaje: 'Error interno en Flotas' }),
      });
      global.fetch = mockFetch;

      const res = await client.notificarDespacho({
        unidadId: 'B-04',
        incidenteId: 'INC-2026-001',
        tipoIncidente: 'INDUSTRIAL',
        ubicacion: 'Av. Banzer 4to Anillo',
        latitud: -17.7500,
        longitud: -63.1700,
        prioridad: 'ALTA',
      });

      expect(res.exito).toBe(false);
      expect(res.mensaje).toBeDefined();
    });
  });
});
