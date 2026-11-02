# PLAN DE IMPLEMENTACIÓN TÉCNICA - MS-01: COMANDOS Y DESPACHO TÁCTICO
## FASE 1 (Contratos y Mocks) y FASE 2 (Core Clean Architecture, DynamoDB y SSO)

> **Módulo:** `ms1_comandos_backend`  
> **Líder / Responsable:** Nataly Martínez  
> **Materia:** Ingeniería de Software II (INF512 - Semestre 2/2026 - UAGRM)  
> **Docente:** M.Sc. Ing. Rolando Antonio Martinez Canedo  
> **Framework:** Node.js 20+ / TypeScript con NestJS 10+  
> **Patrón Arquitectónico:** Clean Architecture (Capa de Dominio desacoplada al 100%)  
> **Persistencia:** Amazon DynamoDB (Desarrollo local con `amazon/dynamodb-local`)  
> **Protocolos Expuestos:** REST API (OpenAPI 3.0) + WebSockets Gateway (`/ws/sala-crisis`)  

---

## 1. Alcance Técnico y Pregunta Clave de Arquitectura

### 1.1. ¿Por qué MS-01 expone exclusivamente API REST y WebSockets (y NO GraphQL)?
> **Pregunta de Nataly:** *"este microservicio sera solo con api rest, no?"*

**Respuesta Técnica de 9no Semestre:**  
**Sí, categóricamente.**  
Tal como se justificó en la defensa teórica del **Punto 03 (GraphQL vs REST)**:
1. **Comandos Transaccionales de Despacho:** Las órdenes tácticas de emergencia (`POST /api/v1/despacho/iniciar`) son **operaciones de comando atómicas e idempotentes**. GraphQL está optimizado para consultas de grafos multidimensionales con relaciones recursivas; forzar GraphQL en despachos tácticos añade una capa innecesaria de sobrecarga en el serializador y dificulta el manejo de códigos de estado HTTP nativos (`200 OK`, `202 Accepted`, `409 Conflict`, `500 Server Error`).
2. **Latencia Crítica en Sala de Crisis:** En una estación de bomberos, un retraso de 200 ms puede costar vidas. REST proporciona respuestas JSON planas, lineales y ultrarrápidas, mientras que los eventos de telemetría y alertas entrantes se difunden en milisegundos mediante el **Gateway nativo de WebSockets**.
3. **Rol Híbrido de MS-01:** Aunque MS-01 **expone** REST hacia el frontend (`appshell_frontend` y `mfe1_comandos_frontend`), actúa internamente como **cliente consumidor de GraphQL** cuando orquesta la SAGA hacia `ms3_inventario_backend` (Laravel) para reservar espumógeno químico o trajes ignífugos.

---

## 2. Los No Negociables de Ingeniería (Principios Mandatorios)

```text
======================= LAS 5 REGLAS DE ORO DE MS-01 =======================

  [ 1. INDEPENDENCIA DEL DOMINIO ]
  La capa `src/domain/` es SAGRADA. Está prohibido importar cualquier módulo
  de `@nestjs/*`, librerías de AWS (`@aws-sdk/*`) o clientes HTTP.
  El Dominio compila con TypeScript puro sin dependencias externas.

  [ 2. SEGURIDAD SSO: CERO LOCALSTORAGE ]
  Prohibido guardar tokens JWT en LocalStorage (vulnerable a ataques XSS).
  El SSO se implementa mediante cookies `HttpOnly`, `SameSite=Strict`, `Path=/`
  y `Secure` (en producción).

  [ 3. TRANSACCIÓN DISTRIBUIDA SAGA IDEMPOTENTE ]
  Todo comando de despacho debe aceptar cabecera `X-Idempotency-Key` para
  evitar despachos dobles por clics repetidos. Si el inventario falla, el
  orquestador ejecuta obligatoriamente la compensación hacia Flotas.

  [ 4. PERSISTENCIA TOTALMENTE INVERTIDA ]
  Los Casos de Uso solo conocen la interfaz `IIncidenteRepository`. Si el día
  de mañana el docente pide cambiar DynamoDB por MongoDB o PostgreSQL, solo
  se crea un nuevo adaptador en `infrastructure/` sin tocar una sola línea de lógica.

  [ 5. GOBERNANZA HUMAN-IN-THE-LOOP ]
  El despacho nunca se ejecuta de forma autónoma por la IA; el endpoint
  `/api/v1/despacho/iniciar` requiere obligatoriamente el `operador_id` firmado
  en la sesión activa del comandante humano.
```

---

## 3. Modelo de Datos en Amazon DynamoDB (Diseño NoSQL de 6 Tablas Cohesivas)

En Amazon DynamoDB, a diferencia de un motor relacional, no existen claves foráneas (`FOREIGN KEY`) ni operaciones `JOIN`. Para dar soporte completo al **CRUD de incidentes con su línea de tiempo**, al **despacho táctico de múltiples unidades**, a la **auditoría de la SAGA**, a la **autenticación SSO** y al **catálogo de reportes multimodales (CU-07)**, el microservicio se estructura en **6 tablas dedicadas de alta cohesión**:

```text
======================= MODELO DE 6 TABLAS DYNAMODB =======================

  +---------------------------------------------------------------------+
  | TABLA 1: tb_incidentes_emergencia                                   |
  | (Entidad Maestra del Siniestro y Estado General)                    |
  +---------------------------------------------------------------------+
  | PK (Partition Key) : incidente_id (String UUID v7)                  |
  | GSI-1 Partition Key: estado (String: PENDIENTE | EN_CURSO | etc.)    |
  | GSI-1 Sort Key     : fecha_registro (String ISO-8601)               |
  | Atributos:                                                          |
  |   - codigo_radial    : String (Ej. "INC-2026-089")                  |
  |   - tipo_incidente   : String (ESTRUCTURAL | FORESTAL | QUIMICO)    |
  |   - severidad        : String (BAJA | MEDIA | ALTA | CRITICA)       |
  |   - descripcion      : String                                       |
  |   - denunciante      : Map { nombre: String, telefono: String }     |
  |   - ubicacion        : Map { lat: Number, lng: Number, dir: String, |
  |                              zona_cuadrante: String }               |
  |   - unidades_asignadas: Number (Cantidad de camiones despachados)   |
  |   - operador_id      : String (ID del operador que registró)        |
  |   - created_at       : String ISO-8601                              |
  |   - updated_at       : String ISO-8601                              |
  +---------------------------------------------------------------------+

  +---------------------------------------------------------------------+
  | TABLA 2: tb_historial_incidente                                     |
  | (Línea de Tiempo Operativa y Bitácora de Novedades del Siniestro)   |
  +---------------------------------------------------------------------+
  | PK (Partition Key) : incidente_id (String UUID v7)                  |
  | SK (Sort Key)      : timestamp (Number Epoch Milliseconds)          |
  | Atributos:                                                          |
  |   - evento_id        : String UUID v7                               |
  |   - estado_anterior  : String (Null en creación)                    |
  |   - estado_nuevo     : String (PENDIENTE | EN_COMBATE | CONTROLADO) |
  |   - operador_id      : String (ID del operador o comandante)        |
  |   - novedad_texto    : String ("Llegada de cisterna B-04 a escena") |
  |   - nivel_agua_actual: Number (Lts reportados por telemetría)       |
  +---------------------------------------------------------------------+

  +---------------------------------------------------------------------+
  | TABLA 3: tb_despachos_tacticos                                      |
  | (Asignación y Ciclo de Vida de Unidades y Recursos en Escena)       |
  +---------------------------------------------------------------------+
  | PK (Partition Key) : despacho_id (String UUID v7)                   |
  | GSI-1 Partition Key: incidente_id (String UUID v7)                  |
  | GSI-1 Sort Key     : fecha_despacho (String ISO-8601)               |
  | Atributos:                                                          |
  |   - camion_id        : String (ID camión en MS-02 Flotas: "CAM-B04")|
  |   - conductor_id     : String (ID bombero al volante)               |
  |   - estado_despacho  : String (EN_RUTA | EN_ESCENA | LIBERADO)      |
  |   - insumos_asociados: List [ { insumo_id, nombre, cantidad } ]    |
  |   - hora_despacho    : String ISO-8601                              |
  |   - hora_arribo      : String (Null hasta llegada)                  |
  |   - hora_liberacion  : String (Null hasta retorno)                  |
  |   - operador_autoriza: String (ID del comandante que aprobó)        |
  +---------------------------------------------------------------------+

  +---------------------------------------------------------------------+
  | TABLA 4: tb_bitacora_saga                                           |
  | (Orquestación Transaccional Distribuida e Idempotencia con TTL)     |
  +---------------------------------------------------------------------+
  | PK (Partition Key) : saga_id (String UUID v7)                       |
  | SK (Sort Key)      : timestamp (Number Epoch Milliseconds)          |
  | GSI-1 Partition Key: idempotency_key (String - Prevención dobles)   |
  | Atributos:                                                          |
  |   - incidente_id     : String UUID                                  |
  |   - estado_saga      : String (INICIADA | RESERVA_CAMION_OK |       |
  |                                RESERVA_INSUMO_OK | COMPENSANDO |    |
  |                                COMPENSADA | COMPLETADA)             |
  |   - paso_actual      : String (PASO_1_FLOTAS | PASO_2_INVENTARIO)   |
  |   - detalle_error    : String (Null o traza de excepción)           |
  |   - payload_rollback : Map (Datos para compensar en MS-02 o MS-03)  |
  |   - ttl_expiracion   : Number (Auto-eliminación en 30 días)         |
  +---------------------------------------------------------------------+

  +---------------------------------------------------------------------+
  | TABLA 5: tb_usuarios_sso                                            |
  | (Credenciales Criptográficas, Cuentas y Roles para el SSO)         |
  +---------------------------------------------------------------------+
  | PK (Partition Key) : usuario_id (String UUID v7)                    |
  | GSI-1 Partition Key: email (String - Búsqueda rápida en Login)      |
  | Atributos:                                                          |
  |   - nombre_completo  : String                                       |
  |   - email            : String (Unique)                              |
  |   - password_hash    : String (Bcrypt Cost Factor 12)               |
  |   - rol              : String (OPERADOR | BOMBERO | ADMINISTRADOR)  |
  |   - estacion_base    : String ("Estación Central - Santa Cruz")     |
  |   - activo           : Boolean                                      |
  |   - ultimo_login     : String ISO-8601                              |
  |   - created_at       : String ISO-8601                              |
  +---------------------------------------------------------------------+

  +---------------------------------------------------------------------+
  | TABLA 6: tb_reportes_ejecutivos                                     |
  | (Catálogo y Metadatos de Reportes Multimodales Generados - CU-07)   |
  +---------------------------------------------------------------------+
  | PK (Partition Key) : reporte_id (String UUID v7)                    |
  | GSI-1 Partition Key: comandante_id (String UUID v7)                 |
  | GSI-1 Sort Key     : fecha_generacion (String ISO-8601)             |
  | Atributos:                                                          |
  |   - titulo           : String ("Reporte Semanal de Incendios")      |
  |   - comando_voz_origen: String ("Genera resumen en PDF de...")      |
  |   - formatos_disponibles: List [ "MARKDOWN", "PDF", "EXCEL", "AUDIO"]|
  |   - archivo_pdf_url  : String (S3 URL o path local)                 |
  |   - archivo_excel_url: String (S3 URL o path local)                 |
  |   - archivo_audio_url: String (S3 URL con síntesis Edge-TTS)        |
  |   - metricas_resumen : Map { total_incidentes: 14, agua_lts: 45000 }|
  |   - created_at       : String ISO-8601                              |
  +---------------------------------------------------------------------+
```

### 3.1. Justificación de 9no Semestre: ¿Por qué 6 tablas y no un Single-Table Design crudo?
1. **Alineación con Clean Architecture:** Cada tabla mapea directamente a un **Aggregate Root de Dominio** (`IncidenteEmergencia`, `HistorialIncidente`, `DespachoTactico`, `Usuario`, `ReporteEjecutivo`). Un Single-Table Design obliga a mezclar entidades en un solo repositorio con claves sobrecargadas (`PK=INC#...`, `SK=METADATA#...`), rompiendo el Principio de Responsabilidad Única y acoplando el dominio a DynamoDB.
2. **Aislamiento de Capacidad y Throughput:** `tb_historial_incidente` y `tb_despachos_tacticos` reciben escrituras intensivas durante siniestros activos, mientras `tb_usuarios_sso` y `tb_reportes_ejecutivos` son de lectura esporádica. Tablas dedicadas permiten configurar auto-escalado independiente sin encarecer la infraestructura.
3. **Depuración Automática con TTL:** Tablas temporales como `tb_bitacora_saga` utilizan el atributo nativo `ttl_expiracion` para auto-eliminarse tras 30 días sin costo de computación.

---

## 4. Estructura Exhaustiva de Carpetas (Clean Architecture en NestJS)

Siguiendo la especificación definida en el **Punto 10 (Arquitecturas de Código)**, la estructura de directorios en `ms1_comandos_backend/src/` es la siguiente:

```text
ms1_comandos_backend/
├── docker/
│   └── docker-compose.local.yml           # DynamoDB Local + DynamoDB Admin UI
├── scripts/
│   ├── init-dynamodb.sh                   # Creación de tablas e índices en local
│   └── seed-data.ts                       # Seeder de usuarios y alarmas de prueba
├── test/                                  # Pruebas e2e y unitarias
│   ├── jest-e2e.json
│   └── despacho.e2e-spec.ts
├── src/
│   ├── domain/                            # =======================================
│   │   ├── entities/                      # CAPA 1: DOMINIO PURO (Reglas Críticas)
│   │   │   ├── incidente-emergencia.entity.ts # Entidad Maestra de Incidente
│   │   │   ├── historial-incidente.entity.ts  # Entidad Bitácora / Timeline
│   │   │   ├── despacho-tactico.entity.ts     # Entidad Asignación de Unidades
│   │   │   ├── usuario.entity.ts              # Entidad de Usuario y Cuentas
│   │   │   └── reporte-ejecutivo.entity.ts    # Entidad de Reportes Multimodales (CU-07)
│   │   ├── value-objects/
│   │   │   ├── coordenada-gps.vo.ts       # Latitud/Longitud con validación
│   │   │   ├── estado-incidente.vo.ts     # PENDIENTE, DESPACHADO, CONTROLADO
│   │   │   └── nivel-severidad.vo.ts      # BAJA, MEDIA, ALTA, CRITICA
│   │   ├── events/
│   │   │   ├── incidente-despachado.event.ts # Evento inmutable de despacho
│   │   │   └── alerta-critica.event.ts       # Evento para difusión en tiempo real
│   │   ├── exceptions/
│   │   │   ├── estado-invalido.exception.ts
│   │   │   └── incidente-no-encontrado.exception.ts
│   │   └── repositories/
│   │       ├── incidente.repository.interface.ts # Puerto persistencia incidentes
│   │       ├── historial.repository.interface.ts # Puerto línea de tiempo
│   │       ├── despacho.repository.interface.ts  # Puerto despachos tácticos
│   │       ├── usuario.repository.interface.ts   # Puerto usuarios SSO
│   │       ├── reporte.repository.interface.ts   # Puerto reportes ejecutivos
│   │       └── saga-log.repository.interface.ts  # Puerto de auditoría SAGA
│   │
│   ├── application/                       # =======================================
│   │   ├── use-cases/                     # CAPA 2: CASOS DE USO (Orquestación)
│   │   │   ├── despachar-emergencia.use-case.ts # Orquestador SAGA de despacho
│   │   │   ├── registrar-incidente.use-case.ts  # Registro inicial de siniestro
│   │   │   ├── cambiar-estado-incidente.use-case.ts # Transición + Historial
│   │   │   ├── listar-incidentes-activos.use-case.ts # Consulta para Sala de Crisis
│   │   │   ├── obtener-timeline-incidente.use-case.ts# Historial de novedades
│   │   │   ├── login-sso.use-case.ts            # Autenticación y firma JWT
│   │   │   └── validar-sesion.use-case.ts       # Verificación de identidad
│   │   ├── dtos/                          # Data Transfer Objects
│   │   │   ├── auth/
│   │   │   │   ├── login-request.dto.ts
│   │   │   │   └── login-response.dto.ts
│   │   │   ├── incidente/
│   │   │   │   ├── crear-incidente.dto.ts
│   │   │   │   ├── cambiar-estado.dto.ts
│   │   │   │   └── incidente-response.dto.ts
│   │   │   └── despacho/
│   │   │       ├── iniciar-despacho.dto.ts
│   │   │       └── resultado-despacho.dto.ts
│   │   └── ports/                         # Puertos Secundarios (Salida)
│   │       ├── flotas-client.port.ts      # Contrato hacia MS-02 Flotas
│   │       ├── inventario-client.port.ts  # Contrato hacia MS-03 Inventario
│   │       ├── token-service.port.ts      # Contrato de tokens JWT
│   │       └── event-notifier.port.ts     # Contrato de emisión WebSockets
│   │
│   ├── infrastructure/                    # =======================================
│   │   ├── persistence/                   # CAPA 3: ADAPTADORES DE PERSISTENCIA
│   │   │   └── dynamodb/
│   │   │       ├── dynamodb-client.factory.ts # Conexión AWS SDK v3
│   │   │       ├── dynamodb-incidente.repository.ts # Implementa IIncidenteRepo
│   │   │       ├── dynamodb-historial.repository.ts # Implementa IHistorialRepo
│   │   │       ├── dynamodb-despacho.repository.ts  # Implementa IDespachoRepo
│   │   │       ├── dynamodb-usuario.repository.ts   # Implementa IUsuarioRepo
│   │   │       ├── dynamodb-reporte.repository.ts   # Implementa IReporteRepo
│   │   │       └── dynamodb-saga-log.repository.ts  # Implementa ISagaLogRepo
│   │   │
│   │   ├── external-clients/              # ADAPTADORES HACIA OTROS MICROSERVICIOS
│   │   │   ├── flotas/
│   │   │   │   ├── http-flotas.client.ts  # Cliente Axios hacia Spring Boot
│   │   │   │   └── mock-flotas.client.ts  # MOCK FASE 1: Trabajar sin Maikol
│   │   │   └── inventario/
│   │   │       ├── graphql-inventario.client.ts # Cliente GraphQL hacia Laravel
│   │   │       └── mock-inventario.client.ts    # MOCK FASE 1: Trabajar sin Jael
│   │   │
│   │   ├── security/                      # ADAPTADORES DE SEGURIDAD Y SSO
│   │   │   ├── jwt-token.service.ts       # Implementa ITokenService con @nestjs/jwt
│   │   │   ├── bcrypt-password-hasher.ts  # Hashing con bcryptjs
│   │   │   ├── guards/
│   │   │   │   ├── jwt-cookie-auth.guard.ts # Lee cookie HttpOnly 'token_sesion'
│   │   │   │   └── roles.guard.ts         # Control de roles @Roles('COMANDANTE')
│   │   │   └── decorators/
│   │   │       ├── current-user.decorator.ts
│   │   │       └── roles.decorator.ts
│   │   │
│   │   ├── websockets/                    # ADAPTADOR DE TIEMPO REAL
│   │   │   └── sala-crisis.gateway.ts     # WebSocketGateway (@WebSocketGateway)
│   │   │
│   │   ├── controllers/                   # ADAPTADORES PRIMARIOS (REST API)
│   │   │   ├── auth.controller.ts         # POST /api/v1/auth/login, logout, me
│   │   │   ├── incidentes.controller.ts   # GET /api/v1/incidentes, POST
│   │   │   └── despacho.controller.ts     # POST /api/v1/despacho/iniciar
│   │   │
│   │   └── config/                        # CONFIGURACIONES Y SWAGGER
│   │       ├── env.validation.ts          # Validación con class-validator
│   │       └── swagger.config.ts          # Configuración OpenAPI en /api/docs
│   │
│   ├── modules/                           # =======================================
│   │   ├── auth.module.ts                 # Ensamblado NestJS de autenticación
│   │   ├── incidentes.module.ts           # Ensamblado de incidentes
│   │   ├── despacho.module.ts             # Ensamblado de SAGA
│   │   └── app.module.ts                  # Módulo raíz del microservicio
│   │
│   └── main.ts                            # Punto de entrada (Bootstrap NestJS)
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env.example
```

---

## 5. Explicación Archivo por Archivo: ¿Qué Hace Cada Componente?

Para que tanto Nataly como los agentes automatizados puedan programar sin dudas:

### 5.1. Capa de Dominio (`src/domain/`)
* **`incidente-emergencia.entity.ts`:** Clase TypeScript pura. Contiene atributos del siniestro y métodos de negocio (`iniciarDespacho()`, `confirmarControlado()`, `marcarEnCombate()`). Lanza `EstadoInvalidoException` si se intenta despachar un incidente ya cerrado. **Prohibido importar `@nestjs/*`**.
* **`historial-incidente.entity.ts`:** Entidad inmutable que registra la línea de tiempo del incidente (cada cambio de estado, hora exacta, novedad reportada por radio y operador responsable).
* **`despacho-tactico.entity.ts`:** Entidad que modela la asignación de cada unidad móvil, camión cisterna e insumos químicos en escena, con sus marcas de tiempo (despacho, arribo, liberación).
* **`usuario.entity.ts`:** Entidad con id, email, passwordHash, rol y métodos como `verificarPassword()` y `desactivarCuenta()`.
* **`reporte-ejecutivo.entity.ts`:** Entidad de catálogo de reportes generados por voz / RAG (CU-07), con metadatos y enlaces de descarga.
* **`coordenada-gps.vo.ts`:** Value Object inmutable. Valida que latitud esté entre -90 y 90, y longitud entre -180 y 180.
* **`estado-incidente.vo.ts`:** Enum o tipo union: `'PENDIENTE' | 'DESPACHADO' | 'EN_COMBATE' | 'CONTROLADO' | 'CERRADO'`.
* **`incidente-despachado.event.ts`:** Estructura de evento de dominio con fecha, id de incidente, unidad de camión y operador.
* **`*.repository.interface.ts`:** Interfaces que definen los métodos que la infraestructura debe proveer (`guardar()`, `buscarPorId()`, `listarActivos()`, `obtenerTimeline()`, etc.).

### 5.2. Capa de Aplicación (`src/application/`)
* **`despachar-emergencia.use-case.ts`:** El núcleo del patrón SAGA.
  1. Busca el incidente en DynamoDB.
  2. Llama a la entidad para cambiar estado a `DESPACHADO`.
  3. Llama a `flotasClient.reservarCamion()`.
  4. Llama a `inventarioClient.reservarInsumos()`.
  5. Si Inventario falla: dispara `flotasClient.liberarCamion()` (compensación), revierte estado en DynamoDB y registra en `tb_bitacora_saga`.
  6. Si todo tiene éxito: guarda en `tb_incidentes_emergencia`, crea registro en `tb_despachos_tacticos`, agrega entrada en `tb_historial_incidente` y emite alerta por WebSocket.
* **`cambiar-estado-incidente.use-case.ts`:** Actualiza el estado del siniestro y automáticamente inserta una novedad en `tb_historial_incidente`.
* **`login-sso.use-case.ts`:** Busca usuario por email, compara hash bcrypt, genera JWT firmado con claims (`sub`, `email`, `rol`) y devuelve el token listo para inyectarse en la cookie.
* **`ports/*.port.ts`:** Interfaces que definen los clientes HTTP externos hacia Flotas e Inventario, desacoplando la lógica de Axios o Apollo Client.

### 5.3. Capa de Infraestructura (`src/infrastructure/`)
* **`dynamodb-client.factory.ts`:** Instancia `DynamoDBClient` y `DynamoDBDocumentClient` de `@aws-sdk/lib-dynamodb`. Si detecta `NODE_ENV=development`, apunta a `http://localhost:8000`.
* **`dynamodb-*.repository.ts`:** Implementaciones concretas para las 6 tablas (`tb_incidentes`, `tb_historial`, `tb_despachos`, `tb_usuarios`, `tb_reportes`, `tb_saga_log`).
* **`mock-flotas.client.ts` y `mock-inventario.client.ts`:** **Esenciales para la Fase 1 y 2**. Simulan respuestas exitosas y de fallo sin depender de que Maikol y Jael tengan sus servicios desplegados.
* **`jwt-cookie-auth.guard.ts`:** Extrae la cookie `token_sesion` del encabezado `req.cookies`, verifica la firma con el secreto JWT y asocia el usuario a `req.user`.
* **`sala-crisis.gateway.ts`:** Servidor WebSockets con Socket.io. Expone eventos `emitirNuevaAlerta`, `unidad_despachada` y `actualizarSemáforo`.
* **`swagger.config.ts`:** Configura el generador OpenAPI de Swagger accesible en `/api/docs`.

---

## 6. Catálogo de Endpoints REST API (Especificación de Rutas)

```text
========================= CATÁLOGO DE ENDPOINTS MS-01 =========================

  MÉTODO | RUTA                               | ACCESO / ROL         | DESCRIPCIÓN
  -------+------------------------------------+----------------------+---------------------------------
  POST   | /api/v1/auth/login                 | Público              | Inicia sesión y emite cookie HttpOnly
  POST   | /api/v1/auth/logout                | Autenticado          | Limpia la cookie 'token_sesion'
  GET    | /api/v1/auth/me                    | Autenticado          | Retorna datos del usuario activo
  -------+------------------------------------+----------------------+---------------------------------
  GET    | /api/v1/incidentes/activos         | Operador / Comandante| Lista incidentes activos (Sala)
  GET    | /api/v1/incidentes/:id             | Operador / Comandante| Detalle completo del incidente
  GET    | /api/v1/incidentes/:id/timeline    | Operador / Comandante| Línea de tiempo / novedades
  GET    | /api/v1/incidentes/:id/despachos   | Operador / Comandante| Unidades asignadas al siniestro
  POST   | /api/v1/incidentes                 | Operador / Ciudadano | Registra un nuevo incidente
  PATCH  | /api/v1/incidentes/:id/estado      | Operador             | Actualiza estado y crea historial
  -------+------------------------------------+----------------------+---------------------------------
  POST   | /api/v1/despacho/iniciar           | Comandante de Guardia| Dispara la transacción SAGA
  GET    | /api/v1/despacho/:sagaId/auditoria | Administrador / Audit| Consulta traza de compensación
  -------+------------------------------------+----------------------+---------------------------------
  GET    | /api/v1/reportes                   | Comandante / Admin   | Historial de reportes ejecutivos
  GET    | /api/v1/reportes/:id/descargar     | Comandante / Admin   | Descarga de archivo (PDF/Excel)
```

### 6.1. Detalle del Endpoint Estrella: `POST /api/v1/despacho/iniciar`
* **Cabeceras:**  
  `Cookie: token_sesion=<JWT>`  
  `X-Idempotency-Key: 7b2e3a1f-4c5b-489e-b9b2-3e2b2a1a0987`
* **Cuerpo de Petición (Request Body):**
  ```json
  {
    "incidente_id": "0192e3a4-8f12-789a-bcde-000000000001",
    "camion_id": "CAM-B04",
    "insumos_requeridos": [
      { "insumo_id": "INS-ESPUMA-AFFF", "cantidad": 200 },
      { "insumo_id": "INS-TRAJE-CLASE-A", "cantidad": 4 }
    ]
  }
  ```
* **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "status": "EXITO",
    "saga_id": "saga_0192e3a5-bc12-7000-8000-111122223333",
    "mensaje": "Unidad despachada e insumos reservados con éxito",
    "datos": {
      "incidente_id": "0192e3a4-8f12-789a-bcde-000000000001",
      "estado_actual": "DESPACHADO",
      "camion_asignado": "CAM-B04",
      "tiempo_estimado_arribo_minutos": 7.5
    }
  }
  ```
* **Respuesta con Compensación SAGA por fallo en Inventario (`409 Conflict`):**
  ```json
  {
    "status": "COMPENSACION_EJECUTADA",
    "saga_id": "saga_0192e3a5-bc12-7000-8000-111122223333",
    "codigo_error": "STOCK_INSUFICIENTE_INVENTARIO",
    "mensaje": "No hay stock de espumógeno químico en MS-03. Se revirtió la asignación del camión CAM-B04 en MS-02.",
    "incidente_estado": "PENDIENTE_REASIGNACION"
  }
  ```

---

## 7. Entorno de Desarrollo Local con Docker y DynamoDB Local

Para que Nataly pueda desarrollar de forma independiente sin costos en AWS:

### 7.1. Archivo `docker/docker-compose.local.yml`
```yaml
version: '3.8'

services:
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    container_name: bomberos-dynamodb-local
    command: "-jar DynamoDBLocal.jar -sharedDb -dbPath ./data"
    ports:
      - "8000:8000"
    volumes:
      - dynamodb_data:/home/dynamodblocal/data
    working_dir: /home/dynamodblocal

  dynamodb-admin:
    image: aaronshaf/dynamodb-admin:latest
    container_name: bomberos-dynamodb-admin
    environment:
      - DYNAMO_ENDPOINT=http://dynamodb-local:8000
      - AWS_REGION=us-east-1
    ports:
      - "8001:8001"
    depends_on:
      - dynamodb-local

volumes:
  dynamodb_data:
```

* **DynamoDB Endpoint:** `http://localhost:8000`
* **DynamoDB Admin UI (Visualizador Web de Tablas):** `http://localhost:8001`

---

## 8. Seeders de Datos Iniciales (Datos Listos para Probar)

El script `scripts/seed-data.ts` precargará los siguientes datos esenciales:

### 8.1. Usuarios Operativos (SSO)
| Nombre Completo | Email | Contraseña Plana (Hasheada con Bcrypt) | Rol |
|---|---|---|---|
| Nataly Martínez (Comandancia / Despacho) | `nataly.comandos@bomberos.gob.bo` | `Comandos2026!` | `OPERADOR` |
| Bombero Conductor (Cisterna B-04) | `bombero.b04@bomberos.gob.bo` | `Bombero2026!` | `BOMBERO` |
| Admin General del Sistema | `admin@bomberos.gob.bo` | `AdminSeguro2026!` | `ADMINISTRADOR` |

### 8.2. Incidentes de Prueba (Coordenadas de Santa Cruz de la Sierra)
* **Incidente 1 (Químico / Crítico - Listo para Despachar en Vivo):**
  * ID: `0192e3a4-8f12-789a-bcde-000000000001`
  * Código: `INC-2026-SCZ-001`
  * Tipo: `QUIMICO` | Severidad: `CRITICA` | Estado: `PENDIENTE`
  * Ubicación: Parque Industrial PI-27, Santa Cruz (Lat: `-17.7654`, Lng: `-63.1432`, Zona: "Parque Industrial").
  * Descripción: "Derrame de solvente inflamable con combustión activa en galpón industrial 4."
* **Incidente 2 (Estructural / Alto - En Combate):**
  * ID: `0192e3a4-8f12-789a-bcde-000000000002`
  * Código: `INC-2026-SCZ-002`
  * Tipo: `ESTRUCTURAL` | Severidad: `ALTA` | Estado: `EN_COMBATE`
  * Ubicación: 2do Anillo y Av. Monseñor Rivero (Lat: `-17.7712`, Lng: `-63.1815`).
  * Unidades asignadas: 1 (`CAM-B02`).

### 8.3. Despachos Tácticos y Línea de Tiempo (Historial)
* **Despacho del Incidente 2 (`tb_despachos_tacticos`):**
  * Despacho ID: `desp-0192e3a4-8f12-789a-0001`
  * Camión: `CAM-B02` (Cisterna 10.000 Lts)
  * Insumos: 150 Lts Espuma AFFF, 2 Equipos ERA autónomos.
  * Estado: `EN_ESCENA` (Llegada confirmada).
* **Línea de Tiempo del Incidente 2 (`tb_historial_incidente`):**
  * `T-0`: "Alarma recibida por reporte ciudadano vía WhatsApp bot."
  * `T+1 min`: "Comandante Nataly aprobó despacho táctico. SAGA orquestada con éxito."
  * `T+7 min`: "Unidad CAM-B02 arribó a la escena. Presurización de mangueras iniciada."

### 8.4. Reporte Ejecutivo de Demostración (`tb_reportes_ejecutivos` - CU-07)
* **Reporte ID:** `rep-0192e3a4-8f12-789a-0099`
* **Título:** "Informe de Situación Operativa - Octubre 2026"
* **Comando de Voz Origen:** "Generar informe consolidado de los siniestros atendidos esta semana y consumo de espumógeno"
* **Formatos:** Markdown disponible en pantalla, PDF WeasyPrint compilado, síntesis de audio Edge-TTS.

---

## 9. Comandos para Levantar y Probar el Proyecto

```bash
# 1. Entrar al directorio
cd /home/nataly/Projects/sw2/ms1_comandos_backend

# 2. Levantar la base de datos DynamoDB Local y Admin UI
docker compose -f docker/docker-compose.local.yml up -d

# 3. Instalar dependencias de NestJS
npm install

# 4. Crear las tablas e índices en DynamoDB Local
npm run db:setup

# 5. Ejecutar los seeders de usuarios e incidentes
npm run db:seed

# 6. Iniciar el microservicio en modo desarrollo
npm run start:dev

# 7. Acceder a Swagger y DynamoDB Admin:
# -> Swagger UI interactivo: http://localhost:3000/api/docs
# -> DynamoDB Visualizador:  http://localhost:8001
```

---

## 10. Guía de Commits (Conventional Commits)

Cada tarea completada por el agente o por Nataly debe seguir este estándar:

* `feat(auth): implementar sso con jwt en cookies httponly y same-site strict`
* `feat(domain): crear entidad pura IncidenteEmergencia con reglas de estado`
* `feat(dynamodb): configurar cliente aws sdk v3 y migracion de tablas locales`
* `feat(saga): implementar despachar-emergencia use case con compensacion rollback`
* `feat(websockets): crear sala-crisis gateway para emitir alertas en vivo`
* `docs(swagger): documentar esquemas y endpoints rest en openapi 3.0`
* `test(saga): agregar pruebas de compensacion distribuidas con mocks de flotas e inventario`
