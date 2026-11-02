import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './modules/app.module';
import { setupSwagger } from './infrastructure/config/swagger.config';
import { EnvConfig } from './infrastructure/config/env.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap-MS1-Comandos');
  const app = await NestFactory.create(AppModule);

  // 1. Parser de Cookies (Obligatorio para leer la cookie HttpOnly 'token_sesion')
  app.use(cookieParser());

  // 2. CORS para soportar el App Shell y Microfrontends con credenciales
  app.enableCors({
    origin: (origin, callback) => {
      // Permite localhost en desarrollo (puertos 4200, 3000, 5173, etc.)
      callback(null, true);
    },
    credentials: true,
  });

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

  const port = EnvConfig.port;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 MS-01 COMANDOS & DESPACHO TÁCTICO INICIADO CON ÉXITO`);
  logger.log(`🌐 Servidor REST escuchando en: http://localhost:${port}`);
  logger.log(`📚 Swagger OpenAPI Docs en:   http://localhost:${port}/api/docs`);
  logger.log(`⚡ WebSocket Sala Crisis en:  ws://localhost:${port}/ws/sala-crisis`);
  logger.log(`=======================================================`);
}

bootstrap();
