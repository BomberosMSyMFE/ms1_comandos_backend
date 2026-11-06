# MS-01: Comandos y Despacho Táctico
## Plataforma Distribuida Cuerpo de Bomberos 
> **Líder / Responsable:** Nataly Martínez  
> **Tecnología:** Node.js 20+ / TypeScript con NestJS 11+  
> **Base de Datos:** Amazon DynamoDB (Desarrollo local con `amazon/dynamodb-local`)  
> **Patrón Arquitectónico:** Clean Architecture (Capa de Dominio desacoplada al 100%)  
> **Seguridad:** Single Sign-On (SSO) con JWT firmado en cookies `HttpOnly`, `SameSite=Strict`, `Secure`  
> **Tiempo Real:** WebSocket Gateway (`/sala-crisis`) con Socket.io  
> **Transacciones Distribuidas:** Orquestador SAGA de Despacho Táctico con Idempotencia y Compensación de Rollback  

---

## 1. Arquitectura de Código (Clean Architecture)

El microservicio se diseñó siguiendo una separación estricta de responsabilidades en 4 capas concéntricas, asegurando que el modelo de dominio no tenga dependencias de frameworks ni de AWS SDK:

```text
+-----------------------------------------------------------------------------------+
|                        INFRASTRUCTURE LAYER (Capa Externa)                        |
|  - Controllers REST (Incidentes, Despacho, Auth, Reportes)                        |
|  - Gateways WebSockets (SalaCrisisGateway - Socket.io)                            |
|  - Repositorios DynamoDB AWS SDK v3 (@aws-sdk/lib-dynamodb)                       |
|  - Clientes Externos (GraphQL MS3 Inventario / Mock REST MS2 Flotas)              |
|  - Seguridad (JwtCookieAuthGuard, RolesGuard, BcryptPasswordHasher)               |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        APPLICATION LAYER (Casos de Uso)                           |
|  - DespacharEmergenciaUseCase (Orquestador SAGA + Idempotencia)                   |
|  - RegistrarIncidenteUseCase, CambiarEstadoIncidenteUseCase                       |
|  - ListarIncidentesActivosUseCase, ObtenerTimelineIncidenteUseCase                |
|  - LoginSsoUseCase, ValidarSesionUseCase                                          |
|  - Puertos de salida: IFlotasClientPort, IInventarioClientPort, IEventNotifierPort |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                           DOMAIN LAYER (Dominio Puro)                             |
|  - Entidades: IncidenteEmergencia, DespachoTactico, HistorialIncidente,           |
|               Usuario, ReporteEjecutivo                                           |
|  - Value Objects: CoordenadaGPS, EstadoIncidente, NivelSeveridad, RolUsuario      |
|  - Eventos de Dominio: IncidenteDespachadoEvent, AlertaCriticaEvent                |
|  - Excepciones de Negocio: EstadoInvalidoException, IncidenteNoEncontradoException |
|  - Interfaces de Repositorio (Puertos Puros)                                      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Roles del Sistema

| Rol | Email | Contraseña | Descripción |
|---|---|---|---|
| **`ADMIN`** | admin@bomberos.gob.bo | `AdminSeguro2026!` | SuperUsuario | 

| **`OPERADOR`** | nataly.comandos@bomberos.gob.bo | `Comandos2026!` | Tel: +591 72115304 (Líder Sala de Crisis)   | 

| **`OPERADOR`** | operador.norte@bomberos.gob.bo | `Operador2026!` | Tel: +591 60495035 (Estación Norte)  |

| **`OPERADOR`** | operador.sur@bomberos.gob.bo | `Operador2026!` | Tel: +591 70012347 (Estación Sur - Plan 3000)   |

| **`OPERADOR`** | operador.este@bomberos.gob.bo | `Operador2026!` | Tel: +591 70012348 (Estación Este - Pampa de la Isla)   |

| **`OPERADOR`** | operador.oeste@bomberos.gob.bo | `Operador2026!` | Tel: +591 70012349 (Estación Oeste - Equipetrol) |
                                                                                                      
| **`BOMBERO`** | 15 Bomberos: bombero.b01@bomberos.gob.bo a bombero.b15@bomberos.gob.bo | `Bombero2026!` | Cuadrilla de Cisterna (Consulta de Incidentes y cambio de estado     

> *Nota operativa:* Los ciudadanos interactúan exclusivamente vía WhatsApp con el bot n8n / webhook externo; no poseen cuentas directas ni credenciales en este microservicio.

---

## 3. Modelo de Persistencia NoSQL (Amazon DynamoDB)

El microservicio utiliza **6 tablas especializadas** diseñadas para baja latencia y alta concurrencia:

| Nombre de Tabla | Partition Key (PK) | Sort Key (SK) | Índices Secundarios Globales (GSI) | Propósito Operativo |
|---|---|---|---|---|
| `tb_incidentes_emergencia` | `incidente_id` (String UUID v7) | — | **GSI_EstadoIncidentes:** PK=`estado`, SK=`created_at` | Registro de siniestros y consulta de activos |
| `tb_despachos_tacticos` | `despacho_id` (String UUID v7) | — | **GSI_DespachosPorIncidente:** PK=`incidente_id`, SK=`fecha_despacho` | Registro de camiones e insumos asignados |
| `tb_historial_incidente` | `incidente_id` (String UUID v7) | `timestamp` (Number Epoch ms) | — | Bitácora inmutable de eventos y novedades |
| `tb_usuarios_sso` | `usuario_id` (String UUID v7) | — | **GSI_EmailUsuarios:** PK=`email` | Credenciales SSO con password hash bcrypt |
| `tb_reportes_ejecutivos` | `reporte_id` (String UUID v7) | — | **GSI_ReportesFecha:** PK=`comandante_id`, SK=`fecha_generacion` | Catálogo de informes multimodales (CU-07) |
| `tb_saga_transacciones_log` | `saga_id` (String UUID v7) | `timestamp` (Number Epoch ms) | **GSI_Idempotencia:** PK=`idempotency_key` | Trazabilidad del Patrón SAGA y compensaciones |

---

## 4. Orquestador SAGA de Despacho Táctico

El orquestador (`DespacharEmergenciaUseCase`) coordina transacciones distribuidas entre MS-01, MS-02 y MS-03:

```text
               +-------------------------------------------+
               |     MS-01: COMANDOS Y DESPACHO TÁCTICO     |
               |         (Orquestador SAGA Nataly)         |
               +-------------------------------------------+
                     |                               |
        (1) Reservar |                  (2) Reservar |
            Camión   |                      Insumos  |
                     v                               v
+-------------------------------+      +---------------------------------+
|   MS-02: FLOTAS Y UNIDADES    |      |    MS-03: INVENTARIO Y EQUIPO   |
|   (Maikol - Spring Boot REST) |      |    (Jael - Laravel GraphQL)     |
+-------------------------------+      +---------------------------------+
          |                                      |
          | (OK: Camión asignado)                | (ERROR: Stock insuficiente o
          |                                      |  presión < 250 bares NFPA)
          +--------------------------------------+
                     |
                     v
   +------------------------------------+
   | ACCIÓN COMPENSATORIA (ROLLBACK)    |
   | MS-01 invoca liberarCamion() hacia |
   | MS-02 para devolver la cisterna.   |
   | Se revierte estado del incidente.  |
   | Se registra auditoría en DynamoDB. |
   +------------------------------------+
```

### Integración con Otros Microservicios:
1. **MS-03 Inventario (Jael - Laravel / PostgreSQL GraphQL):**
   * Mutation de Reserva: `reservarKitParaDespacho(incidenteId, camionId, litrosEspumogeno)`
   * Mutation de Compensación: `liberarReservaCompensatoria(transaccionId)`
   * Implementado en: `src/infrastructure/external-clients/inventario/graphql-inventario.client.ts`
2. **MS-02 Flotas (Maikol - Spring Boot / PostGIS):**
   * Endpoint de Reserva: `POST /api/v1/flotas/unidades/solicitar-despacho`
   * Endpoint de Liberación: `POST /api/v1/flotas/unidades/{id}/liberar`
   * Implementado con `MockFlotasClient` para la Fase 1 y 2, listo para conectar con `HttpFlotasClient` en Fase 3.

---

## 5. Comandos de Inicialización y Ejecución

### 5.1. Levantar DynamoDB Local
```bash
# Iniciar contenedor Docker de DynamoDB Local (:8000) y consola Admin (:8001)
docker compose -f docker/docker-compose.local.yml up -d
```

### 5.2. Migrar Tablas y Cargar Seeders
```bash
# Crear las 6 tablas con sus índices GSI
npm run db:setup

# Cargar usuarios SSO, siniestros y bitácora de prueba
npm run db:seed
```

### 5.3. Iniciar el Servidor de Desarrollo
```bash
npm run start:dev
```

### 5.4. Pruebas Automatizadas (Jest)
```bash
npm test
```

---

## 6. Documentación Swagger y Enlaces Útiles

* **Swagger UI interactivo:** `http://localhost:3000/api/docs`
* **DynamoDB Admin UI:** `http://localhost:8001`
* **Guía Completa de Pruebas:** Consulta [`GUIA_PRUEBAS.md`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/GUIA_PRUEBAS.md) para probar paso a paso cada endpoint con sus JSON DTOs exactos.
* **Guía Maestra para la Defensa:** Consulta [`GUIA_DEFENSA_ARQUITECTURA_Y_CODIGO.md`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/GUIA_DEFENSA_ARQUITECTURA_Y_CODIGO.md) para la explicación línea por línea de la llamada GraphQL real, el patrón SAGA y la seguridad SSO con cookies HttpOnly.
* **Guía Técnica de Inventario (Jael):** Consulta [`GUIA_MS3_INVENTARIO_TECNICA.md`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/GUIA_MS3_INVENTARIO_TECNICA.md).
* **Plan de Implementación Detallado:** Consulta [`PLAN_IMPLEMENTACION_MS1.md`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/PLAN_IMPLEMENTACION_MS1.md).
* **Script de Commits Convencionales:** Ejecuta `./commits.sh` cuando desees generar los commits modulares en tu repositorio git local.
