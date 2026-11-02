# GUÍA COMPLETA DE PRUEBAS END-TO-END Y SWAGGER UI
## Microservicio MS-01: Comandos y Despacho Táctico
> **Líder / Desarrolladora:** Nataly Martínez — Semestre 2/2026 (INF512)  
> **Puerto del Servidor:** `http://localhost:3000`  
> **Documentación Swagger UI:** `http://localhost:3000/api/docs`  
> **DynamoDB Admin UI:** `http://localhost:8001`  
> **WebSocket Gateway:** `ws://localhost:3000` (Namespace `/sala-crisis`)

---

## 1. Preparación del Entorno Local

Antes de realizar cualquier prueba, asegúrate de tener levantado DynamoDB local y las tablas migradas con sus datos iniciales:

```bash
# 1. Asegurar que el daemon de Docker esté activo en tu máquina Linux
sudo systemctl start docker

# 2. Levantar el contenedor de DynamoDB Local y la interfaz DynamoDB Admin
cd /home/nataly/Projects/sw2/ms1_comandos_backend
docker compose -f docker/docker-compose.local.yml up -d

# 3. Crear las 6 tablas y sus índices secundarios globales (GSIs)
npm run db:setup

# 4. Poblar los datos de prueba (usuarios, siniestros y bitácora)
npm run db:seed

# 5. Iniciar la aplicación NestJS en modo desarrollo
npm run start:dev
```

Verificación visual:
- Abre en tu navegador `http://localhost:8001` para ver la consola de DynamoDB Admin con las 6 tablas (`tb_usuarios_sso`, `tb_incidentes_emergencia`, `tb_despachos_tacticos`, `tb_historial_incidente`, `tb_reportes_ejecutivos`, `tb_saga_transacciones_log`).
- Abre `http://localhost:3000/api/docs` para ver la interfaz interactiva de Swagger UI.

---

## 2. Autenticación en Swagger UI (Dos Métodos Disponibles)

El sistema de seguridad de Nataly implementa autenticación dual:
1. **Cookie HttpOnly (`token_sesion`)**: Se inyecta de forma automática en la respuesta del navegador al hacer login.
2. **Bearer Token (Authorization Header)**: En Swagger UI, también puedes hacer clic en el botón verde **"Authorize"** (arriba a la derecha) e ingresar el token JWT devuelto en el JSON de login.

### Credenciales de Prueba Disponibles (Seeders):

| Rol | Email | Contraseña | Descripción |
|---|---|---|---|
| **`OPERADOR`** | `nataly.comandos@bomberos.gob.bo` | `Comandos2026!` | Despachador en Sala de Crisis (Acceso a Despacho SAGA, CRUD Incidentes, Reportes) |
| **`BOMBERO`** | `bombero.b04@bomberos.gob.bo` | `Bombero2026!` | Cuadrilla de Cisterna (Consulta de Incidentes y cambio de estado en escena) |
| **`ADMINISTRADOR`** | `admin@bomberos.gob.bo` | `AdminSeguro2026!` | Auditoría global y administración de plataforma |

---

## 3. Pruebas Paso a Paso en Swagger UI

### CASO DE PRUEBA 1: Iniciar Sesión Único (SSO)
* **Endpoint:** `POST /api/v1/auth/login`
* **Etiqueta Swagger:** `Autenticación & SSO`
* **Cuerpo de la Petición (JSON):**
```json
{
  "email": "nataly.comandos@bomberos.gob.bo",
  "password": "Comandos2026!"
}
```
* **Respuesta Esperada (`200 OK`):**
```json
{
  "mensaje": "Autenticación exitosa",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "usr_0192e3a4-8f12-789a-bcde-000000000001",
    "nombreCompleto": "Nataly Martínez (Comandancia / Despacho)",
    "email": "nataly.comandos@bomberos.gob.bo",
    "rol": "OPERADOR",
    "estacionBase": "Estación Central - Santa Cruz"
  }
}
```
* **Cabecera HTTP retornada:** `Set-Cookie: token_sesion=...; Path=/; HttpOnly; SameSite=Strict`
* **Paso siguiente en Swagger:** Copia el valor del campo `token`, pulsa el botón **Authorize** en Swagger UI, pégalo en la sección `bearerAuth` y pulsa **Authorize**.

---

### CASO DE PRUEBA 2: Validar Sesión Activa (`/me`)
* **Endpoint:** `GET /api/v1/auth/me`
* **Etiqueta Swagger:** `Autenticación & SSO`
* **Respuesta Esperada (`200 OK`):**
```json
{
  "usuarioId": "usr_0192e3a4-8f12-789a-bcde-000000000001",
  "email": "nataly.comandos@bomberos.gob.bo",
  "rol": "OPERADOR"
}
```

---

### CASO DE PRUEBA 3: Consultar Incidentes Activos en Sala de Crisis
* **Endpoint:** `GET /api/v1/incidentes/activos`
* **Etiqueta Swagger:** `Incidentes & Alertas`
* **Respuesta Esperada (`200 OK`):** Retorna la lista de siniestros cargados por el seeder (ej. Parque Industrial PI-27 y 2do Anillo):
```json
[
  {
    "id": "0192e3a4-8f12-789a-bcde-000000000001",
    "codigoRadial": "INC-2026-SCZ-001",
    "tipoIncidente": "QUIMICO",
    "severidad": "CRITICA",
    "descripcion": "Derrame de solvente inflamable con combustión activa en galpón industrial 4.",
    "estado": "PENDIENTE",
    "ubicacion": {
      "lat": -17.7654,
      "lng": -63.1432,
      "dir": "Parque Industrial PI-27, Santa Cruz",
      "zonaCuadrante": "Cuadrante Norte"
    },
    "unidadesAsignadas": 0,
    "operadorId": "usr_0192e3a4-8f12-789a-bcde-000000000001"
  }
]
```

---

### CASO DE PRUEBA 4: Registrar un Nuevo Incidente
* **Endpoint:** `POST /api/v1/incidentes`
* **Etiqueta Swagger:** `Incidentes & Alertas`
* **Cuerpo de la Petición (JSON):**
```json
{
  "tipoIncidente": "ESTRUCTURAL",
  "severidad": "ALTA",
  "descripcion": "Fuego descontrolado en restaurante comercial con tanques de GLP expuestos.",
  "latitud": -17.7834,
  "longitud": -63.1821,
  "direccion": "Av. San Martín y Calle 4, Equipetrol, Santa Cruz",
  "zonaCuadrante": "Cuadrante Oeste",
  "denuncianteNombre": "Mariana Justiniano",
  "denuncianteTelefono": "+591 71098765"
}
```
* **Respuesta Esperada (`201 Created`):**
Retorna el incidente creado con su UUID v7 autogenerado, código radial `INC-2026-SCZ-XXXX` y estado `PENDIENTE`.

---

### CASO DE PRUEBA 5: Orquestador SAGA de Despacho — Camino Feliz (Éxito)
Este flujo ejecuta la orquestación distribuida:
1. Valida el incidente en DynamoDB local y cambia su estado a `DESPACHADO`.
2. Llama a MS-02 Flotas para reservar la cisterna `CAM-B04`.
3. Llama a MS-03 Inventario para reservar el Kit de EPP y espumógeno AFFF 3%.
4. Persiste el `DespachoTactico` en DynamoDB y registra la novedad en la bitácora inmutable.
5. Emite la alerta en tiempo real a la Sala de Crisis por WebSockets.

* **Endpoint:** `POST /api/v1/despacho/iniciar`
* **Etiqueta Swagger:** `Despacho Táctico (SAGA)`
* **Cabecera HTTP Opcional:** `X-Idempotency-Key: saga-test-key-scz-001`
* **Cuerpo de la Petición (JSON):**
```json
{
  "incidenteId": "0192e3a4-8f12-789a-bcde-000000000001",
  "camionId": "CAM-B04",
  "conductorId": "usr_0192e3a4-8f12-789a-bcde-000000000002",
  "insumosRequeridos": [
    {
      "insumoId": "INS-ESPUMA-AFFF",
      "cantidad": 200
    },
    {
      "insumoId": "INS-KIT-EPP-300BAR",
      "cantidad": 2
    }
  ]
}
```
* **Respuesta Esperada (`200 OK`):**
```json
{
  "status": "EXITO",
  "sagaId": "saga_0192e3b5-...",
  "mensaje": "Unidad despachada e insumos reservados con éxito mediante orquestador SAGA.",
  "datos": {
    "incidenteId": "0192e3a4-8f12-789a-bcde-000000000001",
    "estadoActual": "DESPACHADO",
    "camionAsignado": "CAM-B04",
    "tiempoEstimadoArriboMinutos": 6.5,
    "despachoId": "desp_0192e3b5-..."
  }
}
```

---

### CASO DE PRUEBA 6: Orquestador SAGA — Fallo y Rollback Compensatorio
Este caso demuestra la robustez del Patrón SAGA de Nataly:
1. Se solicita un insumo agotado (`INS-SIN-STOCK`) o una cantidad superior al stock (> 1000 litros).
2. MS-02 Flotas reserva con éxito inicialmente el camión.
3. MS-03 Inventario rechaza la reserva por falta de stock o presión de cilindros (< 250 bares, norma NFPA).
4. El orquestador de MS-01 intercepta el rechazo y **ejecuta la acción compensatoria**: llama de inmediato a MS-02 Flotas para liberar el camión reservado, revierte el estado del siniestro y audita el fallo.

* **Endpoint:** `POST /api/v1/despacho/iniciar`
* **Etiqueta Swagger:** `Despacho Táctico (SAGA)`
* **Cuerpo de la Petición (JSON):**
```json
{
  "incidenteId": "0192e3a4-8f12-789a-bcde-000000000001",
  "camionId": "CAM-B04",
  "insumosRequeridos": [
    {
      "insumoId": "INS-SIN-STOCK",
      "cantidad": 1500
    }
  ]
}
```
* **Respuesta Esperada (`409 Conflict`):**
```json
{
  "status": "COMPENSACION_EJECUTADA",
  "sagaId": "saga_0192e3b6-...",
  "codigoError": "STOCK_INSUFICIENTE_INVENTARIO",
  "mensaje": "Fallo en inventario: Stock insuficiente en almacén o tanques con presión < 250 bares (Norma NFPA).. Se ejecutó el rollback liberando la unidad CAM-B04.",
  "incidenteEstado": "PENDIENTE"
}
```

---

### CASO DE PRUEBA 7: Auditoría y Trazabilidad de la Transacción SAGA
Consulta la bitácora inmutable de pasos registrados para la transacción ejecutada en el caso anterior.

* **Endpoint:** `GET /api/v1/despacho/{sagaId}/auditoria`
* **Etiqueta Swagger:** `Despacho Táctico (SAGA)`
* **Parámetro `sagaId`:** El ID de saga obtenido en la respuesta previa (ej. `saga_0192e3b6-...`).
* **Respuesta Esperada (`200 OK`):** Retorna la secuencia completa de pasos (`PASO_0_VALIDACION_DOMINIO`, `PASO_1_FLOTAS`, `PASO_2_INVENTARIO_ROLLBACK`) con sus marcas de tiempo y cargas útiles.

---

### CASO DE PRUEBA 8: Transición de Estado y Línea de Tiempo del Siniestro
Permite al Bombero o al Operador actualizar el estado a `EN_COMBATE`, `CONTROLADO` o `CERRADO`:

* **Endpoint:** `PATCH /api/v1/incidentes/{id}/estado`
* **Parámetro `id`:** `0192e3a4-8f12-789a-bcde-000000000002`
* **Cuerpo de la Petición (JSON):**
```json
{
  "nuevoEstado": "CONTROLADO",
  "novedadTexto": "Focos principales extinguidos. Cuadrilla realizando tareas de enfriamiento y ventilación mecánica.",
  "nivelAguaActual": 4500
}
```
* **Respuesta Esperada (`200 OK`):** Incidente actualizado con estado `CONTROLADO`.

* **Consultar Bitácora:** `GET /api/v1/incidentes/{id}/timeline`  
Retorna todos los eventos cronológicos registrados para este siniestro.

---

### CASO DE PRUEBA 9: Catálogo de Reportes Ejecutivos (CU-07)
* **Endpoint:** `GET /api/v1/reportes`
* **Etiqueta Swagger:** `Reportes Ejecutivos`
* **Respuesta Esperada (`200 OK`):** Retorna los informes consolidados con enlaces a descargas (PDF, Excel, Audio generado por síntesis de voz).

---

## 4. Prueba Rápida con cURL (Terminal)

Si deseas probar el flujo completo desde tu terminal Linux:

```bash
# 1. Login y obtención del token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nataly.comandos@bomberos.gob.bo","password":"Comandos2026!"}' \
  | jq -r '.token')

echo "Token obtenido: $TOKEN"

# 2. Consultar incidentes activos usando el Bearer Token
curl -s -X GET http://localhost:3000/api/v1/incidentes/activos \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. Disparar Despacho SAGA con Idempotencia
curl -s -X POST http://localhost:3000/api/v1/despacho/iniciar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: saga-curl-001" \
  -d '{
    "incidenteId": "0192e3a4-8f12-789a-bcde-000000000001",
    "camionId": "CAM-B04",
    "insumosRequeridos": [{"insumoId": "INS-ESPUMA-AFFF", "cantidad": 150}]
  }' | jq .
```

---

## 5. Prueba de WebSockets (Sala de Crisis en Tiempo Real)

Puedes conectar cualquier cliente Socket.io al namespace `/sala-crisis` en `ws://localhost:3000`:
- **Evento emitido por el servidor:** `alerta_critica` cuando se crea un incidente de severidad `CRITICA` o `ALTA`.
- **Evento emitido por el servidor:** `despacho_completado` cuando el orquestador SAGA finaliza con éxito.
- **Evento emitido por el servidor:** `incidente_actualizado` cuando cambia el estado de combate.
