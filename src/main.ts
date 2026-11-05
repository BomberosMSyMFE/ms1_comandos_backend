import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './modules/app.module';
import { setupSwagger } from './infrastructure/config/swagger.config';
import { EnvConfig } from './infrastructure/config/env.config';
import { TacticalLoggerService } from './infrastructure/logging/tactical-logger.service';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const tacticalLogger = app.get(TacticalLoggerService);
  app.useLogger(tacticalLogger);

  tacticalLogger.log('BOOTSTRAP', 'Iniciando MS-01: Microservicio de Comandos y Despacho Táctico...');

  // 1. Parser de Cookies (Obligatorio para leer la cookie HttpOnly 'token_sesion')
  app.use(cookieParser());
  tacticalLogger.log(
    'BOOTSTRAP',
    `Cookie Parser activo | Cookie Name: '${EnvConfig.cookieName}' | SameSite: ${EnvConfig.cookieSameSite} | Secure: ${EnvConfig.cookieSecure}`,
  );

  // 2. CORS para soportar el App Shell y Microfrontends con credenciales
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  });
  tacticalLogger.log('BOOTSTRAP', 'CORS habilitado con soporte para credenciales y cookies HttpOnly.');

  // 3. Validación Global de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 4. Documentación Interactiva Swagger OpenAPI 3.0
  setupSwagger(app);
  tacticalLogger.log('BOOTSTRAP', 'OpenAPI 3.0 Swagger configurado en /api/docs.');

  // 5. Verificación de conectividad DynamoDB
  try {
    const rawClient = new DynamoDBClient({
      region: EnvConfig.awsRegion,
      endpoint: EnvConfig.dynamodbEndpoint,
      credentials: {
        accessKeyId: EnvConfig.awsAccessKeyId,
        secretAccessKey: EnvConfig.awsSecretAccessKey,
      },
    });
    const { TableNames = [] } = await rawClient.send(new ListTablesCommand({}));
    tacticalLogger.log(
      'DYNAMODB',
      `Conexión establecida con DynamoDB en ${EnvConfig.dynamodbEndpoint}. Tablas detectadas (${TableNames.length}): [${TableNames.join(', ')}]`,
      { endpoint: EnvConfig.dynamodbEndpoint, tables: TableNames },
    );
  } catch (err: any) {
    tacticalLogger.warn(
      'DYNAMODB',
      `DynamoDB no responde en ${EnvConfig.dynamodbEndpoint} (${err.message}). Inicie docker-compose para persistencia local.`,
      { endpoint: EnvConfig.dynamodbEndpoint, error: err.message },
    );
  }

  // 6. Diagnóstico Táctico de Destinos Externos y Estado de Mocks
  tacticalLogger.log(
    'INTEGRATION',
    `[INFO] Estado USE_MOCKS: ${EnvConfig.useMocks ? 'true (SIMULACION LOCAL MOCK ACTIVA)' : 'false (MODO INTEGRACION REAL CON MICROSERVICIOS)'}`,
    { useMocks: EnvConfig.useMocks },
  );
  tacticalLogger.log(
    'INTEGRATION',
    `[INFO] Destino MS-02 Flotas: ${EnvConfig.ms02FlotasUrl} [${EnvConfig.useMocks ? 'MOCK LOCAL ACTIVO' : 'CONEXION REAL SPRING BOOT'}]`,
    { ms02Url: EnvConfig.ms02FlotasUrl, mode: EnvConfig.useMocks ? 'MOCK' : 'REAL' },
  );
  tacticalLogger.log(
    'INTEGRATION',
    `[INFO] Destino MS-03 Inventario: ${EnvConfig.ms03InventarioUrl} [${EnvConfig.useMocks ? 'MOCK LOCAL ACTIVO' : 'CONEXION REAL GRAPHQL LARAVEL'}]`,
    { ms03Url: EnvConfig.ms03InventarioUrl, mode: EnvConfig.useMocks ? 'MOCK' : 'REAL' },
  );

  const port = EnvConfig.port;
  await app.listen(port);

  // Banner táctico ASCII en consola
  tacticalLogger.logBanner([
    'CUERPO DE BOMBEROS DE SANTA CRUZ - COMANDOS & DESPACHO TÁCTICO (MS-01)',
    'Arquitectura Limpia & Orquestador SAGA de Emergencias (INF512 - 2026)',
    '----------------------------------------------------------------------------',
    `Servidor REST Activo:   http://localhost:${port}`,
    `Swagger OpenAPI 3.0:    http://localhost:${port}/api/docs`,
    `WebSockets Sala Crisis: ws://localhost:${port}/ws/sala-crisis`,
    `DynamoDB Endpoint:      ${EnvConfig.dynamodbEndpoint} (${EnvConfig.awsRegion})`,
    `Estado USE_MOCKS:       ${EnvConfig.useMocks ? 'TRUE (SIMULACION LOCAL AUTONOMA)' : 'FALSE (INTEGRACION CON MICROSERVICIOS REALES)'}`,
    `MS-02 Flotas Endpoint:  ${EnvConfig.ms02FlotasUrl} [${EnvConfig.useMocks ? 'MOCK HABILITADO' : 'INTEGRADO SPRING BOOT'}]`,
    `MS-03 Inventario URL:   ${EnvConfig.ms03InventarioUrl} [${EnvConfig.useMocks ? 'MOCK HABILITADO' : 'GRAPHQL LARAVEL'}]`,
    `SSO Seguridad Cookies:  name=${EnvConfig.cookieName} | sameSite=${EnvConfig.cookieSameSite} | httpOnly=true`,
    '----------------------------------------------------------------------------',
    'ESTADO OPERACIONAL: LISTO PARA RECEPCIÓN DE ALARMAS Y DESPACHO TÁCTICO',
  ]);
}

bootstrap();
