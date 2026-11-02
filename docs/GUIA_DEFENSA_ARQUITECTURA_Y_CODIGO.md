# GUÍA MAESTRA DE DEFENSA: ARQUITECTURA, CÓDIGO Y PATRONES
## Microservicio MS-01: Comandos y Despacho Táctico
> **Materia:** Ingeniería de Software II (INF512 — Semestre 2/2026, UAGRM)  
> **Docente evaluador:** M.Sc. Ing. Rolando Antonio Martinez Canedo  
> **Líder / Autora:** Nataly Martínez (Fullstack / AWS / NestJS)  
> **Propósito de esta guía:** Explicación técnica exhaustiva, línea por línea, de los componentes críticos (`GraphqlInventarioClient`, Patrón SAGA Orquestado, API Gateway Híbrido y SSO con JWT en Cookies HttpOnly) para que cualquier integrante del equipo pueda defender el código con rigurosidad de 9no semestre.

---

## 1. Mocks vs. Clientes Reales y Estrategia de Despliegue

### 1.1. ¿Cómo funcionan los Mocks y los Clientes Reales?
En la carpeta [`src/infrastructure/external-clients/`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/external-clients/) existen dos parejas de adaptadores:
1. **Flotas (MS-02):**
   * [`mock-flotas.client.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/external-clients/flotas/mock-flotas.client.ts): Simula en memoria la asignación de cisternas (`CAM-B04`) con latencia estimada (6.5 min) y simula fallos si se pide `CAM-SIN-STOCK`.
   * [`http-flotas.client.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/external-clients/flotas/http-flotas.client.ts): Cliente HTTP real mediante `fetch` hacia el endpoint REST de Spring Boot (`http://localhost:8082/api/v1/flotas/...`).
2. **Inventario (MS-03):**
   * [`mock-inventario.client.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/external-clients/inventario/mock-inventario.client.ts): Simula en memoria la reserva de kits de respiración y espumógeno AFFF 3%, disparando rechazos automáticos si se pide `INS-SIN-STOCK` o más de 1000 litros.
   * [`graphql-inventario.client.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/external-clients/inventario/graphql-inventario.client.ts): Cliente GraphQL real que emite mutaciones HTTP `POST` hacia Laravel Lighthouse (`http://localhost:8083/graphql`).

### 1.2. La Inyección Dinámica (Clean Architecture en Acción)
En [`src/modules/despacho.module.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/modules/despacho.module.ts#L25-L33):
```typescript
{
  provide: 'IFlotasClientPort',
  useClass: EnvConfig.useMocks ? MockFlotasClient : HttpFlotasClient,
},
{
  provide: 'IInventarioClientPort',
  useClass: EnvConfig.useMocks ? MockInventarioClient : GraphqlInventarioClient,
}
```
* **En desarrollo local con `USE_MOCKS=true`:** NestJS inyecta los mocks. Esto permite probar el microservicio de forma autónoma sin depender de que Maikol o Jael tengan sus contenedores o nubes encendidas.
* **En integración con `USE_MOCKS=false`:** NestJS inyecta los clientes reales. **El caso de uso de negocio (`DespacharEmergenciaUseCase`) no cambia ni una sola línea de código**. Esto demuestra el Principio de Inversión de Dependencias (SOLID - D).

### 1.3. ¿Por qué el Despliegue en la Nube debe mantenerse al final (Fase 5)?
Siguiendo la planificación de [`PUNTO_12_ALCANCE_Y_PLAN_IMPLEMENTACION.md`](file:///home/nataly/Projects/sw2/documentation/PUNTO_12_ALCANCE_Y_PLAN_IMPLEMENTACION.md):
1. **Fase 1 y 2 (Días 1 - 7):** Congelar contratos y construir cores en local con bases de datos aisladas (DynamoDB Local, PostGIS Local, Laravel Local).
2. **Fase 3 (Días 8 - 10):** Integración de backends. En esta fase, si Jael levanta su Laravel en local (`localhost:8083`), tú cambias `USE_MOCKS=false` y pruebas la llamada GraphQL real **en red local**. No necesitas lidiar aún con DNS, firewalls de AWS ni túneles de Tailscale.
3. **Fase 4 (Días 11 - 12):** Microfrontends federados en Angular 18, React y Vue. Se consumen los puertos locales de desarrollo (`:3000`, `:8082`, `:8083`).
4. **Fase 5 (Días 13 - 14):** Despliegue Multi-Cloud definitivo (AWS, GCP, Azure) e interconexión mediante la red P2P Mesh de Tailscale (`100.x.y.z`).  
> *Razón de ingeniería:* Intentar desplegar en la nube antes de tener el software probado en local genera una fricción innecesaria (errores de CORS, costos por minutos de cómputo en AWS/GCP, problemas de NAT y bloqueos por VPN cuando el código aún está mutando). La Fase 5 se reserva para la estabilidad de producción y el ensayo de defensa.

---

## 2. Explicación Línea por Línea: `GraphqlInventarioClient`

Ubicación del código fuente: [`src/infrastructure/external-clients/inventario/graphql-inventario.client.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/external-clients/inventario/graphql-inventario.client.ts)  
*(El archivo `.d.ts` en `dist/` es únicamente la declaración de tipos generada por el compilador TypeScript).*

A continuación se detalla la anatomía de cada línea para la defensa:

### 2.1. Encabezado e Inyección de Dependencias (Líneas 1 - 13)
```typescript
1:  import { Injectable, Logger } from '@nestjs/common';
2:  import {
3:    IInventarioClientPort,
4:    InsumoReservaItem,
5:    ReservaInsumosResponse,
6:  } from '../../../application/ports/inventario-client.port';
7:  import { EnvConfig } from '../../config/env.config';
8:  
9:  @Injectable()
10: export class GraphqlInventarioClient implements IInventarioClientPort {
11:   private readonly logger = new Logger(GraphqlInventarioClient.name);
12:   private readonly graphqlUrl = EnvConfig.ms03InventarioUrl;
```
* **Líneas 1-7:** Se importa `@Injectable` para que NestJS lo reconozca como provider, la interfaz pura del puerto `IInventarioClientPort` (ubicada en la capa de aplicación) y las variables de configuración.
* **Línea 9:** `@Injectable()` permite que este adaptador sea inyectado en el contenedor IoC de NestJS.
* **Línea 10:** `implements IInventarioClientPort` garantiza el cumplimiento estricto del contrato arquitectónico definido por el Dominio/Aplicación. Si el cliente cambiara de GraphQL a gRPC o REST, la firma no se altera.
* **Líneas 11-12:** Instancia el logger de NestJS para auditoría en consola y obtiene la URL del endpoint GraphQL (`http://localhost:8083/graphql` o la IP de Tailscale de Azure en Fase 5).

---

### 2.2. Método `reservarInsumos()`: Transacción Pivot de la SAGA (Líneas 14 - 80)
```typescript
14:   async reservarInsumos(
15:     incidenteId: string,
16:     camionId: string,
17:     insumos?: InsumoReservaItem[],
18:     litrosEspumogeno?: number,
19:   ): Promise<ReservaInsumosResponse> {
```
* **Líneas 14-19:** Firma del método según la especificación de Jael (`GUIA_MS3_INVENTARIO_TECNICA.md`). Recibe el identificador del siniestro, el camión al que se asignarán los insumos y la cantidad de espumógeno químico requerida.

```typescript
20:     const mutation = `
21:       mutation ReservarKitParaDespacho(
22:         $incidenteId: String!
23:         $camionId: String!
24:         $litrosEspumogeno: Float
25:       ) {
26:         reservarKitParaDespacho(
27:           incidenteId: $incidenteId
28:           camionId: $camionId
29:           litrosEspumogeno: $litrosEspumogeno
30:         ) {
31:           exito
32:           transaccionId
33:           materialesReservados
34:           mensaje
35:         }
36:       }
37:     `;
```
* **Líneas 20-37:** Construcción de la mutación GraphQL exacta.
  * A diferencia de una consulta (`query`), se utiliza `mutation` porque modifica el estado de la base de datos (descuenta stock en la base de datos PostgreSQL de Jael).
  * Solicita campos precisos: `exito`, `transaccionId` (vital para el rollback compensatorio posterior), `materialesReservados` y `mensaje`. Esto previene el problema de *over-fetching* (PUNTO_03).

```typescript
44:       const response = await fetch(this.graphqlUrl, {
45:         method: 'POST',
46:         headers: { 'Content-Type': 'application/json' },
47:         body: JSON.stringify({
48:           query: mutation,
49:           variables: {
50:             incidenteId,
51:             camionId,
52:             litrosEspumogeno: litrosEspumogeno || 250.0,
53:           },
54:         }),
55:       });
```
* **Líneas 44-55:** Ejecución de la llamada de red:
  * Toda petición GraphQL estándar se envía mediante **HTTP POST** con `Content-Type: application/json`.
  * El cuerpo contiene dos claves: `query` (el string con la mutación tipada) y `variables` (los valores dinámicos sanitizados para prevenir inyecciones sintácticas).

```typescript
57:       const body = await response.json();
58:       if (body.errors && body.errors.length > 0) {
59:         this.logger.warn(`[GraphQL MS-03] Error en respuesta: ${body.errors[0].message}`);
60:         return {
61:           exito: false,
62:           error: body.errors[0].message || 'Error en GraphQL MS-03 Inventario',
63:         };
64:       }
```
* **Líneas 57-64:** **Manejo de Errores de Grafo (Peculiaridad de GraphQL):**
  * En GraphQL, un error de esquema o validación no devuelve HTTP 500; responde HTTP 200 pero con un array `errors` en el JSON raíz.
  * El código intercepta esta condición y retorna `exito: false`, lo cual alertará inmediatamente a la SAGA para disparar el rollback.

```typescript
66:       const resData = body.data?.reservarKitParaDespacho;
67:       return {
68:         exito: resData?.exito || false,
69:         transaccionId: resData?.transaccionId,
70:         materialesReservados: resData?.materialesReservados,
71:         error: resData?.exito ? undefined : resData?.mensaje,
72:       };
```
* **Líneas 66-72:** Desempaqueta `data.reservarKitParaDespacho` mapeándolo al Value Object `ReservaInsumosResponse` de la arquitectura limpia de MS-01.

---

### 2.3. Método `liberarInsumos()`: Acción Compensatoria SAGA (Líneas 82 - 117)
```typescript
82:   async liberarInsumos(transaccionId: string, incidenteId?: string): Promise<{ exito: boolean; mensaje?: string }> {
83:     const mutation = `
84:       mutation LiberarReservaCompensatoria($transaccionId: String!) {
85:         liberarReservaCompensatoria(transaccionId: $transaccionId) {
86:           exito
87:           mensaje
88:         }
89:       }
90:     `;
```
* **Líneas 82-90:** Mutación de compensación SAGA. Si MS-01 reservó insumos en MS-03 pero más adelante ocurriera una falla en la consolidación local, se llama a esta mutación pasando el `transaccionId` para devolver el stock al estado `DISPONIBLE`.

---

## 3. El Patrón SAGA Orquestado: Teoría y Código Fuente

### 3.1. ¿Por qué SAGA y no Two-Phase Commit (2PC)?
> **Pregunta obligatoria del Ing. Martínez:**  
> *"¿Por qué no hicieron una transacción SQL normal con BEGIN TRANSACTION y COMMIT entre los tres microservicios?"*
* **Respuesta de Ingeniería:**
  1. **Autonomía y Heterogeneidad:** MS-01 usa Amazon DynamoDB (NoSQL), MS-02 usa PostgreSQL/PostGIS (Spring Boot) y MS-03 usa PostgreSQL/Laravel. No existe un coordinador transaccional nativo que abarque tecnologías y nubes tan distintas.
  2. **Bloqueo de Recursos (Resource Locking en 2PC):** En 2PC, la base de datos de Maikol y la de Jael tendrían que mantener bloqueos pesados en tablas (*locks*) mientras esperan la respuesta por Internet. Si la red se cae, las bases de datos quedan congeladas.
  3. **Eventual Consistency:** SAGA divide la transacción distribuida en una secuencia de transacciones locales. Si una falla, se ejecutan **acciones compensatorias semánticas (rollback)** hacia atrás.

### 3.2. Diagrama ASCII del Flujo SAGA en MS-01

```text
======================= SAGA DE DESPACHO TÁCTICO =======================

                [ INICIO: Operador solicita Despacho ]
                                  |
                                  v
            +-------------------------------------------+
            | PASO 0: Verificación de Idempotencia      |
            | ¿Se procesó antes el UUID en DynamoDB?    |
            +-------------------------------------------+
                     |                     |
                  (Sí)                     (No)
                     v                     v
            Retornar 200 OK       +------------------------------------+
            Idempotente sin       | PASO 1: Reservar Camión en MS-02   |
            duplicar recursos     | (Flotas - Spring Boot)             |
                                  +------------------------------------+
                                           |                     |
                                        (Fallo)                (Éxito)
                                           v                     v
                                  Abortar sin rollback  +-------------------------------+
                                  Retornar 409          | PASO 2: Reservar Insumos MS-03|
                                                        | (Inventario - GraphQL)        |
                                                        +-------------------------------+
                                                                 |              |
                                                        (Fallo Insumos)      (Éxito)
                                                                 |              |
                                                                 v              v
                                           +----------------------------+  +--------------------+
                                           | ACCIÓN COMPENSATORIA       |  | PASO 3: CONSOLIDAR |
                                           | MS-01 llama a MS-02:       |  | Guardar Despacho,  |
                                           | liberarCamion()            |  | marcar EN_COMBATE, |
                                           | Revertir estado Incidente. |  | Notificar WS Crisis|
                                           | Registrar en DynamoDB Log. |  | Retornar 200 OK    |
                                           +----------------------------+  +--------------------+
                                                         |
                                                         v
                                                Retornar 409 Conflict
```

### 3.3. Dónde está el Código de la SAGA
El orquestador reside en: [`src/application/use-cases/despachar-emergencia.use-case.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/application/use-cases/despachar-emergencia.use-case.ts)

A continuación los puntos clave del archivo para mostrar en pantalla:

#### 1. Verificación de Idempotencia (Líneas 34 - 50):
```typescript
if (idempotencyKey) {
  const previo = await this.sagaLogRepo.buscarPorIdempotencyKey(idempotencyKey);
  if (previo && previo.estadoSaga === 'COMPLETADA') {
    return {
      status: 'EXITO',
      sagaId: previo.sagaId,
      mensaje: 'Petición ya procesada con anterioridad (Idempotencia activa).',
      datos: { ... }
    };
  }
}
```
* **Explicación:** Si un operador presiona dos veces seguidas el botón "Despachar" en la Sala de Crisis o la red sufre una retransmisión, la cabecera `X-Idempotency-Key` intercepta la petición en DynamoDB y devuelve el resultado previo sin volver a descontar camiones ni duplicar reservas.

#### 2. Paso 1 — Reserva en Flotas (Líneas 72 - 97):
```typescript
const flotasRes = await this.flotasClient.reservarCamion(
  incidente.id,
  incidente.tipoIncidente,
  dto.camionId,
);

if (!flotasRes.exito) {
  incidente.revertirDespacho();
  await this.sagaLogRepo.registrarPaso({ estadoSaga: 'FALLO_PASO_1', ... });
  return { status: 'COMPENSACION_EJECUTADA', codigoError: 'FALLO_RESERVA_FLOTAS', ... };
}
```
* **Explicación:** Llama a MS-02. Si no hay camiones disponibles en el radio de acción, no hay nada que compensar aún; simplemente se anula la intención local y se audita en DynamoDB.

#### 3. Paso 2 — Reserva en Inventario y Rollback Compensatorio (Líneas 116 - 150):
```typescript
const inventarioRes = await this.inventarioClient.reservarInsumos(
  incidente.id,
  flotasRes.camionId,
  insumosAAsignar,
  litrosEspuma,
);

if (!inventarioRes.exito) {
  // ACCIÓN COMPENSATORIA 1: Liberar la cisterna retenida en MS-02
  await this.flotasClient.liberarCamion(incidente.id, flotasRes.camionId);

  // ACCIÓN COMPENSATORIA 2: Revertir estado del incidente a PENDIENTE
  incidente.revertirDespacho();
  await this.incidenteRepo.guardar(incidente);

  // ACCIÓN COMPENSATORIA 3: Bitácora inmutable en DynamoDB
  await this.sagaLogRepo.registrarPaso({
    sagaId,
    estadoSaga: 'COMPENSADA',
    pasoActual: 'PASO_2_INVENTARIO_ROLLBACK',
    payloadRollback: { camionLiberado: flotasRes.camionId },
  });

  return {
    status: 'COMPENSACION_EJECUTADA',
    codigoError: 'STOCK_INSUFICIENTE_INVENTARIO',
    mensaje: `Fallo en inventario: ${inventarioRes.error}. Se ejecutó el rollback liberando la unidad ${flotasRes.camionId}.`,
    incidenteEstado: incidente.estado,
  };
}
```
* **Explicación crucial para el docente:** Si Inventario falla (porque no hay espumógeno suficiente o los tanques tienen presión menor a 250 bar), el orquestador **no deja la cisterna bloqueada en MS-02**. Invoca de inmediato `flotasClient.liberarCamion()` para dejar la cisterna disponible para otros siniestros.

#### 4. Manejo de Códigos HTTP en el Controlador:
En [`src/infrastructure/controllers/despacho.controller.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/controllers/despacho.controller.ts#L56-L63):
```typescript
const resultado = await this.despacharEmergenciaUseCase.execute(dto, operadorId, idempotencyKey);

if (resultado.status === 'COMPENSACION_EJECUTADA') {
  return res.status(HttpStatus.CONFLICT).json(resultado); // HTTP 409
}

return res.status(HttpStatus.OK).json(resultado); // HTTP 200
```
* Si la SAGA compensó por falta de stock o fallo en flotas, responde formalmente **HTTP 409 (Conflict)** con los detalles de qué se liberó, informando claramente a la consola de comandos.

---

## 4. API Gateway Híbrido & SSO (JWT en Cookies HttpOnly)

### 4.1. ¿Por qué se implementó en MS-01 durante la Fase 2?
En el diseño de arquitectura ([`PUNTO_12`](file:///home/nataly/Projects/sw2/documentation/PUNTO_12_ALCANCE_Y_PLAN_IMPLEMENTACION.md) — CU-09):
* **MS-01 Comandos (Nataly) actúa como el Servidor Central de Autenticación y Proveedor de Identidad (IdP).**
* Contiene la tabla maestra de credenciales: `tb_usuarios_sso` en Amazon DynamoDB.
* Toda la plataforma distribuida (el App Shell, el MFE de Flotas de Maikol y el MFE de Inventario de Jael) comparte este inicio de sesión único.

### 4.2. Justificación de Seguridad de 9no Semestre: ¿Por qué Cookies HttpOnly y NO LocalStorage?
> **Pregunta típica del docente:**  
> *"¿Dónde guardan el token JWT en el navegador? ¿En `localStorage`?"*

```text
+------------------------------------+---------------------------------------+
|          LOCALSTORAGE              |    COOKIE HTTPONLY + SAMESITE=STRICT  |
+------------------------------------+---------------------------------------+
| • Vulnerable a ataques XSS:        | • Inmune a lectura por JavaScript:    |
|   Cualquier script inyectado       |   document.cookie NO puede leer el    |
|   (npm malicioso, XSS en input)    |   token. Un atacante XSS jamás puede  |
|   puede leer:                      |   robar el JWT de sesión.             |
|   localStorage.getItem('token')    |                                       |
|                                    | • Blindado contra ataques CSRF:       |
| • Requiere programar interceptores |   SameSite=Strict impide que peticiones|
|   manuales en cada microfront      |   desde otros dominios envíen la      |
|   para adjuntar el Bearer header.  |   cookie.                             |
|                                    |                                       |
| • INSEGURO para sistemas de        | • ESTÁNDAR BANCARIO Y DE MISIÓN       |
|   misión crítica de bomberos.      |   CRÍTICA.                            |
+------------------------------------+---------------------------------------+
```

### 4.3. Dónde está el Código de Seguridad y SSO

#### 1. Emisión de la Cookie HttpOnly:
En [`src/infrastructure/controllers/auth.controller.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/controllers/auth.controller.ts#L33-L49):
```typescript
@Post('login')
async login(@Body() dto: LoginRequestDto, @Res({ passthrough: true }) response: Response) {
  const result = await this.loginSsoUseCase.execute(dto);

  // Inyecta la cookie segura HttpOnly
  response.cookie(EnvConfig.cookieName, result.token, {
    httpOnly: true,
    secure: EnvConfig.cookieSecure,
    sameSite: EnvConfig.cookieSameSite,
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
    path: '/',
  });

  return result;
}
```
* Parámetros de la cookie:
  * `httpOnly: true`: El navegador prohíbe el acceso desde JavaScript (`document.cookie`).
  * `sameSite: 'strict'`: El navegador nunca enviará la cookie en peticiones cross-site, neutralizando ataques Cross-Site Request Forgery (CSRF).
  * `secure: true`: Solo se transmite por HTTPS (en desarrollo local `false` para pruebas HTTP).

#### 2. Extracción y Validación Dual en el Guard:
En [`src/infrastructure/security/guards/jwt-cookie-auth.guard.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/security/guards/jwt-cookie-auth.guard.ts#L38-L51):
```typescript
private extraerToken(request: Request): string | null {
  // 1. Prioridad: Cookie HttpOnly emitida por el SSO
  if (request.cookies && request.cookies[EnvConfig.cookieName]) {
    return request.cookies[EnvConfig.cookieName];
  }

  // 2. Fallback: Cabecera Authorization Bearer (Swagger UI / Postman)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}
```
* **Elegancia de ingeniería:** El guard da **prioridad 1 a la cookie HttpOnly** para el funcionamiento normal del navegador y los microfrontends, pero cuenta con un **fallback a la cabecera `Authorization: Bearer <token>`** para permitir pruebas interactivas en Swagger UI y cURL.

#### 3. Control de Acceso Basado en Roles (RBAC):
En [`src/infrastructure/security/guards/roles.guard.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/security/guards/roles.guard.ts):
* Los endpoints están protegidos por roles mediante decoradores:
  `@Roles(RolUsuario.OPERADOR, RolUsuario.ADMINISTRADOR)`
* Si un `BOMBERO` intenta autorizar un despacho táctico (`POST /api/v1/despacho/iniciar`), el guard arroja **HTTP 403 Forbidden** automáticamente.

#### 4. ¿Cómo se relaciona esto con el "API Gateway Híbrido"?
* En la Fase 4 y 5, el API Gateway (o el App Shell de Angular con Module Federation) actúa como proxy inverso. Cuando el usuario se loguea una vez en `ms1_comandos_backend`, el navegador almacena la cookie con `Path=/`.
* Cada microfrontend montado en el App Shell realiza peticiones a través del Gateway enviando automáticamente la cookie de sesión sin que cada microservicio deba reimplementar una base de datos de usuarios.

---

## 5. Resumen de Archivos Clave para la Defensa

Si el docente pide abrir el editor y mostrar el código en vivo, estos son los archivos exactos a proyectar:

| Concepto a Defender | Archivo Exacto a Proyectar | Qué Resaltar en Pantalla |
|---|---|---|
| **Llamada GraphQL Real** | [`graphql-inventario.client.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/external-clients/inventario/graphql-inventario.client.ts) | Líneas 20-37 (Mutation tipada), 44-55 (`fetch` POST), 58-64 (Manejo de array `errors`). |
| **Inversión de Dependencias** | [`despacho.module.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/modules/despacho.module.ts) | Líneas 25-33 (`useClass: EnvConfig.useMocks ? ... : ...`). |
| **Orquestador SAGA** | [`despachar-emergencia.use-case.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/application/use-cases/despachar-emergencia.use-case.ts) | Líneas 34-50 (Idempotencia), 72-97 (Paso 1 Flotas), 116-150 (Paso 2 Inventario y Rollback `liberarCamion`). |
| **Trazabilidad SAGA** | [`dynamodb-saga-log.repository.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/persistence/dynamodb/dynamodb-saga-log.repository.ts) | Escritura de cada paso en `tb_saga_transacciones_log`. |
| **Emisión SSO HttpOnly** | [`auth.controller.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/controllers/auth.controller.ts) | Líneas 39-46 (`response.cookie` con `httpOnly: true`, `sameSite: 'strict'`). |
| **Guard de Seguridad Dual** | [`jwt-cookie-auth.guard.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/infrastructure/security/guards/jwt-cookie-auth.guard.ts) | Líneas 38-51 (`extraerToken`: Cookie prioritaria + Bearer fallback). |
| **Pruebas Unitarias** | [`despachar-emergencia.use-case.spec.ts`](file:///home/nataly/Projects/sw2/ms1_comandos_backend/src/application/use-cases/despachar-emergencia.use-case.spec.ts) | Test unitario verificando que ante fallo en inventario se llama a `liberarCamion`. |
