import { TacticalLoggerService } from './tactical-logger.service';

describe('TacticalLoggerService (Structured Tactical Logging)', () => {
  let logger: TacticalLoggerService;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new TacticalLoggerService();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('debe registrar logs estructurados INFO con timestamp ISO y tag de servicio', () => {
    logger.log('SAGA-ORCHESTRATOR', 'Despacho iniciado exitosamente', { sagaId: 'saga-123' });

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('[MS-01-COMANDOS]');
    expect(output).toContain('[INFO]');
    expect(output).toContain('[SAGA-ORCHESTRATOR]');
    expect(output).toContain('Despacho iniciado exitosamente');
    expect(output).toContain('"sagaId":"saga-123"');
  });

  it('debe registrar advertencias WARN con contexto y metadatos', () => {
    logger.warn('AUTH-SSO', 'Intento de login fallido', { email: 'bad@bomberos.gob.bo' });

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('[WARN]');
    expect(output).toContain('[AUTH-SSO]');
    expect(output).toContain('Intento de login fallido');
    expect(output).toContain('bad@bomberos.gob.bo');
  });

  it('debe registrar errores ERROR en stderr con trace si está disponible', () => {
    logger.error('DYNAMODB', 'Fallo de conexión', 'Error: Connection Refused', { endpoint: 'http://localhost:8000' });

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    const errorOutput = stderrSpy.mock.calls[0][0];
    const traceOutput = stderrSpy.mock.calls[1][0];

    expect(errorOutput).toContain('[ERROR]');
    expect(errorOutput).toContain('[DYNAMODB]');
    expect(errorOutput).toContain('Fallo de conexión');
    expect(traceOutput).toContain('Error: Connection Refused');
  });

  it('debe ser compatible con la firma estándar de NestJS log(message, context)', () => {
    logger.log('Servidor inicializado', 'Bootstrap');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('[Bootstrap]');
    expect(output).toContain('Servidor inicializado');
  });

  it('debe generar el banner táctico ASCII sin errores', () => {
    logger.logBanner([
      'SISTEMA DE COMANDOS Y DESPACHO TÁCTICO',
      'DESPLIEGUE OPERATIVO CONFIRMADO',
    ]);

    expect(stdoutSpy).toHaveBeenCalled();
  });
});
