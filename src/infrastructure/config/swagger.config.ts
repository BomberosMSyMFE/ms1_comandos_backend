import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('MS-01: Comandos y Despacho Táctico - Bomberos')
    .setDescription(
      'API REST del Microservicio 1 (Líder: Nataly Martínez - Semestre 2/2026 INF512).\n\n' +
      'Gestión de emergencias, autenticación SSO con cookies HttpOnly, orquestación SAGA de despacho y línea de tiempo operativa.',
    )
    .setVersion('1.0.0')
    .addTag('Autenticación & SSO', 'Inicio de sesión único y emisión de cookies HttpOnly')
    .addTag('Incidentes & Alertas', 'CRUD de siniestros y transiciones de estado')
    .addTag('Despacho Táctico (SAGA)', 'Orquestación distribuida con transacciones de compensación')
    .addTag('Reportes Ejecutivos', 'Catálogo de reportes multimodales de la Comandancia (CU-07)')
    .addCookieAuth('token_sesion', {
      type: 'apiKey',
      in: 'cookie',
      name: 'token_sesion',
      description: 'Cookie de sesión HttpOnly emitida por el SSO',
    })
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Documentación API MS-01 Comandos - Bomberos',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
