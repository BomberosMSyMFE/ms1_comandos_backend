import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fakeLocalKeyId',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fakeLocalAccessKey',
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// Ayudante para escritura en lotes (DynamoDB soporta hasta 25 elementos por BatchWrite)
async function batchWriteItems(tableName: string, items: any[]): Promise<void> {
  const chunkSize = 25;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      }),
    );
  }
}

// Direcciones y cuadrantes reales de Santa Cruz de la Sierra (-17.7x, -63.1x)
const UBICACIONES_SCZ = [
  { dir: 'Av. Banzer Km 8, Santa Cruz', cuadrante: 'Cuadrante Norte', lat: -17.7214, lng: -63.1782 },
  { dir: 'Av. Cristo Redentor y 4to Anillo', cuadrante: 'Cuadrante Norte', lat: -17.7495, lng: -63.1732 },
  { dir: 'Av. Beni y 5to Anillo', cuadrante: 'Cuadrante Norte', lat: -17.7420, lng: -63.1610 },
  { dir: 'Av. Alemana y 6to Anillo', cuadrante: 'Cuadrante Norte', lat: -17.7350, lng: -63.1550 },
  { dir: 'Radial 26 y 3er Anillo Externo', cuadrante: 'Cuadrante Norte', lat: -17.7610, lng: -63.1790 },
  { dir: 'Av. Mutualista entre 2do y 3er Anillo', cuadrante: 'Cuadrante Norte', lat: -17.7680, lng: -63.1620 },
  { dir: 'Av. Monseñor Rivero y 1er Anillo', cuadrante: 'Cuadrante Centro', lat: -17.7735, lng: -63.1812 },
  { dir: 'Calle Arenales y 21 de Mayo (Casco Viejo)', cuadrante: 'Cuadrante Centro', lat: -17.7834, lng: -63.1821 },
  { dir: 'Av. Cañoto y Av. Landívar', cuadrante: 'Cuadrante Centro', lat: -17.7850, lng: -63.1910 },
  { dir: 'Av. Irala y Av. Ejército', cuadrante: 'Cuadrante Centro', lat: -17.7920, lng: -63.1840 },
  { dir: 'Av. Bush y 2do Anillo (Zona UAGRM)', cuadrante: 'Cuadrante Centro', lat: -17.7760, lng: -63.1940 },
  { dir: 'Av. Santos Dumont y 5to Anillo', cuadrante: 'Cuadrante Sur', lat: -17.8210, lng: -63.1850 },
  { dir: 'Av. Nuevo Palmar y 8vo Anillo', cuadrante: 'Cuadrante Sur', lat: -17.8450, lng: -63.1790 },
  { dir: 'Av. El Mechero y Radial 10 (Plan 3000)', cuadrante: 'Cuadrante Sur', lat: -17.8280, lng: -63.1380 },
  { dir: 'Av. Paurito y Rotonda Los Lotes', cuadrante: 'Cuadrante Sur', lat: -17.8520, lng: -63.1690 },
  { dir: 'Doble Vía a La Guardia Km 6', cuadrante: 'Cuadrante Sur', lat: -17.8250, lng: -63.2210 },
  { dir: 'Av. Virgen de Cotoca y 3er Anillo Interno', cuadrante: 'Cuadrante Este', lat: -17.7810, lng: -63.1510 },
  { dir: 'Av. Tres Pasos al Frente y Che Guevara', cuadrante: 'Cuadrante Este', lat: -17.8020, lng: -63.1420 },
  { dir: 'Av. 16 de Julio (Villa 1ro de Mayo)', cuadrante: 'Cuadrante Este', lat: -17.7950, lng: -63.1360 },
  { dir: 'Av. Brasil y 2do Anillo (Mercado Los Pozos)', cuadrante: 'Cuadrante Este', lat: -17.7840, lng: -63.1680 },
  { dir: 'Parque Industrial Manzana 14, PI-27', cuadrante: 'Cuadrante Este', lat: -17.7654, lng: -63.1432 },
  { dir: 'Parque Industrial Manzana 8, Av. Libertad', cuadrante: 'Cuadrante Este', lat: -17.7580, lng: -63.1410 },
  { dir: 'Av. San Martín y Calle 7 (Equipetrol)', cuadrante: 'Cuadrante Oeste', lat: -17.7660, lng: -63.1970 },
  { dir: 'Radial 19 y Costanera Río Piraí', cuadrante: 'Cuadrante Oeste', lat: -17.7880, lng: -63.2080 },
  { dir: 'Av. Roca y Coronado y 4to Anillo (Fexpocruz)', cuadrante: 'Cuadrante Oeste', lat: -17.7920, lng: -63.2120 },
];

const DESCRIPCIONES_TIPOS: Record<string, string[]> = {
  ESTRUCTURAL: [
    'Incendio declarado en segundo piso de vivienda multifamiliar con peligro de propagación.',
    'Combustión activa en almacén de plásticos y embalajes con alta carga de fuego.',
    'Foco ígneo en tablero eléctrico principal de centro comercial con densa humareda.',
    'Siniestro en fábrica de colchones y textiles; colapso parcial de cubierta metálica.',
    'Incendio estructural en galería comercial de telas y calzados en casco viejo.',
  ],
  FORESTAL: [
    'Quema de pastizales y matorrales con rápido avance hacia cordón ecológico.',
    'Incendio forestal de interfase urbana con peligro inminente para viviendas contiguas.',
    'Foco de calor descontrolado en terreno baldío de 2 hectáreas impulsado por viento sur.',
    'Quema descontrolada de chaqueo en límite de mancha urbana con baja visibilidad.',
    'Incendio de cobertura vegetal en inmediaciones de autopista con riesgo vial.',
  ],
  QUIMICO: [
    'Derrame de disolventes inflamables e hidrocarburos con conflagración en galpón industrial.',
    'Fuga masiva de amoníaco anhidro con emanación de vapores tóxicos en planta procesadora.',
    'Reacción exotérmica y escape de gas comprimido en depósito químico del Parque Industrial.',
    'Derrame de ácido sulfúrico con vapores corrosivos en laboratorio de fertilizantes.',
    'Ignición de solventes aromáticos y pinturas en nave logística cerrada.',
  ],
  RESCATE: [
    'Colisión vehicular múltiple con atrapamiento físico de tres ocupantes en cabina deformada.',
    'Persona atrapada en pozo de excavación profunda tras deslizamiento de talud.',
    'Rescate técnico de obrero atrapado en silo de granos con atmósfera confinada.',
    'Accidente de tránsito con vuelco de cisterna de combustible y prensado de conductor.',
    'Extracción vehicular de emergencia tras choque frontal contra estructura de hormigón.',
  ],
  VEHICULAR: [
    'Incendio generalizado en camión de alto tonelaje cargado con mercadería en plena vía rápida.',
    'Combustión total de ómnibus de transporte público interprovincial por falla eléctrica.',
    'Colisión e ignición simultánea de dos vehículos particulares con fuga de GLP.',
    'Vehículo utilitario ardiendo en estación de servicio; sofocado preventivo de surtidores.',
    'Incendio en motor de microbús en anillo vial con derrame de diésel sobre calzada.',
  ],
};

const DENUNCIANTES_MOCK = [
  { nombre: 'Ing. Rodrigo Vaca (Seguridad Industrial)', telefono: '+591 78901234' },
  { nombre: 'Vecina Carmen Suárez (Junta Vecinal)', telefono: '+591 77012345' },
  { nombre: 'Oficial Juan Flores (Radio Patrulla 110)', telefono: '+591 76543210' },
  { nombre: 'Dra. Sofía Céspedes (Hospital Francés)', telefono: '+591 71234567' },
  { nombre: 'Cap. Marcelo Antelo (Guardia Municipal)', telefono: '+591 75678901' },
  { nombre: 'Ing. Patricia Aguilera (Gerencia Operaciones)', telefono: '+591 78123456' },
  { nombre: 'Sr. Roberto Méndez (Sereno Parque Industrial)', telefono: '+591 79012345' },
  { nombre: 'Lic. Claudia Torrico (Administración Galerías)', telefono: '+591 74567890' },
];

const CAMIONES_TACTICOS = [
  { id: 'B-01-SCZ', nombre: 'Autobomba Urbana Ataque Rápido', capacidadAguaLts: 4000 },
  { id: 'B-02-SCZ', nombre: 'Autobomba Pesada Primera Salida', capacidadAguaLts: 8000 },
  { id: 'B-04-SCZ', nombre: 'Autobomba Cisterna Nodriza Pesada', capacidadAguaLts: 10000 },
  { id: 'B-08-URB', nombre: 'Autobomba de Ataque Rápido Urbano', capacidadAguaLts: 4000 },
  { id: 'C-01-ABAST', nombre: 'Cisterna Nodriza Gran Abastecimiento', capacidadAguaLts: 15000 },
  { id: 'R-02-RESC', nombre: 'Unidad de Rescate Técnico y HAZMAT', capacidadAguaLts: 2500 },
  { id: 'M-03-ESC', nombre: 'Camión Escala Telescópica 32 Metros', capacidadAguaLts: 3000 },
  { id: 'B-05-SCZ', nombre: 'Autobomba Cisterna Multipropósito', capacidadAguaLts: 9000 },
];

async function seedData() {
  console.log('========================================================================');
  console.log('--- POBLANDO SEEDER MASIVO Y REALISTA PARA MS-01 COMANDOS & DESPACHO ---');
  console.log('========================================================================\n');

  // 1. GENERACIÓN DE HASHES DE CONTRASEÑA
  console.log('1/5. Generando credenciales seguras con bcrypt...');
  const hashAdmin = await bcrypt.hash('AdminSeguro2026!', 10);
  const hashComandos = await bcrypt.hash('Comandos2026!', 10);
  const hashOperador = await bcrypt.hash('Operador2026!', 10);
  const hashBombero = await bcrypt.hash('BomberoSeguro2026!', 10);

  // 2. USUARIOS: 1 Administrador, 5 Operadores, 15 Bomberos (Total: 21)
  console.log('2/5. Construyendo colección de 21 usuarios SSO con teléfonos móviles...');
  const usuarios = [
    // 1 Administrador
    {
      usuario_id: 'usr_admin_001',
      nombre_completo: 'Administrador General del Sistema (Comandancia)',
      email: 'admin@bomberos.gob.bo',
      password_hash: hashAdmin,
      rol: 'ADMINISTRADOR',
      estacion_base: 'Cuartel General - Santa Cruz',
      telefono_movil: '+591 70000001',
      activo: true,
      created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    },
    // 5 Operadores Tácticos
    {
      usuario_id: 'usr_op_nataly_001',
      nombre_completo: 'Nataly Martínez (Líder Sala de Crisis)',
      email: 'nataly.comandos@bomberos.gob.bo',
      password_hash: hashComandos,
      rol: 'OPERADOR',
      estacion_base: 'Estación Central - Santa Cruz',
      telefono_movil: '+591 70012345',
      activo: true,
      created_at: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
    },
    {
      usuario_id: 'usr_op_norte_002',
      nombre_completo: 'Operador Táctico Zona Norte',
      email: 'operador.norte@bomberos.gob.bo',
      password_hash: hashOperador,
      rol: 'OPERADOR',
      estacion_base: 'Estación Norte (Pampa de la Isla)',
      telefono_movil: '+591 70012346',
      activo: true,
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
    {
      usuario_id: 'usr_op_sur_003',
      nombre_completo: 'Operador Táctico Zona Sur',
      email: 'operador.sur@bomberos.gob.bo',
      password_hash: hashOperador,
      rol: 'OPERADOR',
      estacion_base: 'Estación Sur (Plan 3000)',
      telefono_movil: '+591 70012347',
      activo: true,
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
    {
      usuario_id: 'usr_op_este_004',
      nombre_completo: 'Operador Táctico Zona Este',
      email: 'operador.este@bomberos.gob.bo',
      password_hash: hashOperador,
      rol: 'OPERADOR',
      estacion_base: 'Estación Este (Villa 1ro de Mayo)',
      telefono_movil: '+591 70012348',
      activo: true,
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
    {
      usuario_id: 'usr_op_oeste_005',
      nombre_completo: 'Operador Táctico Zona Oeste',
      email: 'operador.oeste@bomberos.gob.bo',
      password_hash: hashOperador,
      rol: 'OPERADOR',
      estacion_base: 'Estación Oeste (Equipetrol / Radial 19)',
      telefono_movil: '+591 70012349',
      activo: true,
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  // 15 Bomberos operativos
  const estacionesNombres = [
    'Estación Central - Santa Cruz',
    'Estación Norte (Pampa de la Isla)',
    'Estación Sur (Plan 3000)',
    'Estación Este (Villa 1ro de Mayo)',
    'Estación Parque Industrial PI-27',
  ];

  for (let i = 1; i <= 15; i++) {
    const numStr = i < 10 ? `0${i}` : `${i}`;
    usuarios.push({
      usuario_id: `usr_bombero_${numStr}`,
      nombre_completo: `Sargento de Bomberos B-${numStr}`,
      email: `bombero.b${numStr}@bomberos.gob.bo`,
      password_hash: hashBombero,
      rol: 'BOMBERO',
      estacion_base: estacionesNombres[(i - 1) % estacionesNombres.length],
      telefono_movil: `+591 700200${numStr}`,
      activo: true,
      created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
    });
  }

  await batchWriteItems('tb_usuarios_sso', usuarios);
  console.log(`✅ ${usuarios.length} usuarios SSO guardados exitosamente en tb_usuarios_sso.`);

  // 3. GENERACIÓN DE INCIDENTES (Mínimo 500 filas)
  // Distribución requerida:
  // 350 en LIQUIDADO
  // 100 en CONTROLADO
  // 35 en EN_COMBATE
  // 10 en DESPACHADO
  // 5 en PENDIENTE
  console.log('\n3/5. Generando 500 incidentes georreferenciados en Santa Cruz de la Sierra...');

  const estadosDistribucion: Array<{ estado: string; cantidad: number; minMinutosAtras: number; maxMinutosAtras: number }> = [
    { estado: 'LIQUIDADO', cantidad: 350, minMinutosAtras: 2 * 24 * 60, maxMinutosAtras: 30 * 24 * 60 },
    { estado: 'CONTROLADO', cantidad: 100, minMinutosAtras: 4 * 60, maxMinutosAtras: 24 * 60 },
    { estado: 'EN_COMBATE', cantidad: 35, minMinutosAtras: 30, maxMinutosAtras: 3 * 60 },
    { estado: 'DESPACHADO', cantidad: 10, minMinutosAtras: 10, maxMinutosAtras: 25 },
    { estado: 'PENDIENTE', cantidad: 5, minMinutosAtras: 1, maxMinutosAtras: 8 },
  ];

  const tiposLista = ['ESTRUCTURAL', 'FORESTAL', 'QUIMICO', 'RESCATE', 'VEHICULAR'];
  const severidadesLista = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

  const incidentes: any[] = [];
  const historiales: any[] = [];
  const despachos: any[] = [];
  const sagas: any[] = [];

  let correlativoGlobal = 1;
  const operadorIds = ['usr_op_nataly_001', 'usr_op_norte_002', 'usr_op_sur_003', 'usr_op_este_004', 'usr_op_oeste_005'];
  const bomberoIds = usuarios.filter((u) => u.rol === 'BOMBERO').map((u) => u.usuario_id);

  for (const dist of estadosDistribucion) {
    for (let i = 0; i < dist.cantidad; i++) {
      const idStr = String(correlativoGlobal).padStart(4, '0');
      const incidenteId = `inc-2026-scz-${idStr}`;
      const codigoRadial = `INC-2026-SCZ-${idStr}`;

      const ubicacionBase = UBICACIONES_SCZ[(correlativoGlobal - 1) % UBICACIONES_SCZ.length];
      // Pequeño desplazamiento aleatorio para variar coordenadas en el mapa (jitter realista)
      const latJitter = ubicacionBase.lat + (Math.random() - 0.5) * 0.008;
      const lngJitter = ubicacionBase.lng + (Math.random() - 0.5) * 0.008;

      const tipoIncidente = tiposLista[(correlativoGlobal - 1) % tiposLista.length];
      const descripcionesTipo = DESCRIPCIONES_TIPOS[tipoIncidente];
      const descripcion = descripcionesTipo[(correlativoGlobal - 1) % descripcionesTipo.length];

      const severidad = severidadesLista[(correlativoGlobal - 1) % severidadesLista.length];
      const operadorAsignado = operadorIds[(correlativoGlobal - 1) % operadorIds.length];
      const denunciante = DENUNCIANTES_MOCK[(correlativoGlobal - 1) % DENUNCIANTES_MOCK.length];

      // Cálculo de tiempo
      const minutosAtras = Math.floor(
        Math.random() * (dist.maxMinutosAtras - dist.minMinutosAtras) + dist.minMinutosAtras,
      );
      const createdAtDate = new Date(Date.now() - minutosAtras * 60 * 1000);
      const updatedAtDate = new Date(createdAtDate.getTime() + Math.min(minutosAtras * 60 * 1000, 30 * 60 * 1000));

      const unidadesAsignadas = dist.estado === 'PENDIENTE' ? 0 : severidad === 'CRITICA' ? 2 : 1;

      const incidenteItem = {
        incidente_id: incidenteId,
        codigo_radial: codigoRadial,
        tipo_incidente: tipoIncidente,
        severidad: severidad,
        descripcion: descripcion,
        estado: dist.estado,
        ubicacion: {
          lat: Number(latJitter.toFixed(6)),
          lng: Number(lngJitter.toFixed(6)),
          dir: ubicacionBase.dir,
          zona_cuadrante: ubicacionBase.cuadrante,
        },
        unidades_asignadas: unidadesAsignadas,
        operador_id: operadorAsignado,
        denunciante: denunciante,
        created_at: createdAtDate.toISOString(),
        updated_at: updatedAtDate.toISOString(),
      };

      incidentes.push(incidenteItem);

      // 4. GENERACIÓN DE HISTORIAL TIMELINE VINCULADO
      // Evento 1: Creación en estado PENDIENTE
      historiales.push({
        incidente_id: incidenteId,
        timestamp: createdAtDate.getTime(),
        evento_id: `evt_${idStr}_01`,
        estado_anterior: null,
        estado_nuevo: 'PENDIENTE',
        operador_id: operadorAsignado,
        novedad_texto: `Alarma ingresada a Sala de Crisis por ${denunciante.nombre}. Clasificado como siniestro ${tipoIncidente} (${severidad}).`,
      });

      // Si el incidente avanzó de estado, creamos los eventos sucesivos de la bitácora
      if (dist.estado !== 'PENDIENTE') {
        const tDespacho = createdAtDate.getTime() + 2 * 60 * 1000;
        historiales.push({
          incidente_id: incidenteId,
          timestamp: tDespacho,
          evento_id: `evt_${idStr}_02`,
          estado_anterior: 'PENDIENTE',
          estado_nuevo: 'DESPACHADO',
          operador_id: operadorAsignado,
          novedad_texto: `Despacho táctico aprobado. Orquestación SAGA completada con reserva de cisterna e inventario EPP.`,
        });

        // Despacho táctico correspondiente
        const camion = CAMIONES_TACTICOS[(correlativoGlobal - 1) % CAMIONES_TACTICOS.length];
        const conductor = bomberoIds[(correlativoGlobal - 1) % bomberoIds.length];

        const despachoItem = {
          despacho_id: `desp_${idStr}_01`,
          incidente_id: incidenteId,
          camion_id: camion.id,
          conductor_id: conductor,
          operador_autoriza: operadorAsignado,
          estado_despacho: dist.estado === 'DESPACHADO' ? 'EN_RUTA' : 'FINALIZADO',
          insumos_asociados: [
            { insumoId: 'INS-ESPUMA-AFFF', nombre: 'Espuma Química AFFF', cantidad: 150 },
            { insumoId: 'INS-TRAJE-CLASE-A', nombre: 'Traje Autónomo Nivel A', cantidad: 2 },
            { insumoId: 'INS-MANGUERA-25', nombre: 'Línea de Manguera Sintética 2.5 pulg', cantidad: 4 },
          ],
          fecha_despacho: new Date(tDespacho).toISOString(),
          hora_arribo: new Date(tDespacho + 8 * 60 * 1000).toISOString(),
        };
        despachos.push(despachoItem);

        // Si se asignaron 2 unidades (severidad CRITICA), creamos un segundo despacho
        if (unidadesAsignadas > 1) {
          const camion2 = CAMIONES_TACTICOS[(correlativoGlobal) % CAMIONES_TACTICOS.length];
          const conductor2 = bomberoIds[(correlativoGlobal) % bomberoIds.length];
          despachos.push({
            despacho_id: `desp_${idStr}_02`,
            incidente_id: incidenteId,
            camion_id: camion2.id,
            conductor_id: conductor2,
            operador_autoriza: operadorAsignado,
            estado_despacho: dist.estado === 'DESPACHADO' ? 'EN_RUTA' : 'FINALIZADO',
            insumos_asociados: [
              { insumoId: 'INS-ESPUMA-AFFF', nombre: 'Espuma Química AFFF', cantidad: 200 },
              { insumoId: 'INS-KIT-FERTILIZANTES', nombre: 'Kit de Neutralización Química', cantidad: 1 },
            ],
            fecha_despacho: new Date(tDespacho + 1 * 60 * 1000).toISOString(),
            hora_arribo: new Date(tDespacho + 9 * 60 * 1000).toISOString(),
          });
        }

        // Bitácora SAGA para la transacción distribuida
        const sagaId = `saga_${idStr}_tx`;
        sagas.push({
          saga_id: sagaId,
          timestamp: tDespacho,
          idempotency_key: `idemp_${idStr}_flotas`,
          paso: 'RESERVA_CAMION_FLOTAS_COMPLETADA',
          estado: 'EXITO',
          incidente_id: incidenteId,
          recurso_afectado: camion.id,
          duracion_ms: 124.5,
        });
        sagas.push({
          saga_id: sagaId,
          timestamp: tDespacho + 150,
          idempotency_key: `idemp_${idStr}_inventario`,
          paso: 'RESERVA_INSUMOS_INVENTARIO_COMPLETADA',
          estado: 'EXITO',
          incidente_id: incidenteId,
          recurso_afectado: 'INS-ESPUMA-AFFF / INS-TRAJE-CLASE-A',
          duracion_ms: 88.2,
        });
        sagas.push({
          saga_id: sagaId,
          timestamp: tDespacho + 300,
          idempotency_key: `idemp_${idStr}_consolidar`,
          paso: 'SAGA_DESPACHO_CONSOLIDADA',
          estado: 'CONSOLIDADO',
          incidente_id: incidenteId,
          duracion_ms: 212.7,
        });
      }

      if (dist.estado === 'EN_COMBATE' || dist.estado === 'CONTROLADO' || dist.estado === 'LIQUIDADO') {
        const tCombate = createdAtDate.getTime() + 10 * 60 * 1000;
        historiales.push({
          incidente_id: incidenteId,
          timestamp: tCombate,
          evento_id: `evt_${idStr}_03`,
          estado_anterior: 'DESPACHADO',
          estado_nuevo: 'EN_COMBATE',
          operador_id: operadorAsignado,
          novedad_texto: `Unidad táctica en escena. Presurización de mangueras y ataque ofensivo iniciado.`,
          nivel_agua_actual: 8500,
        });
      }

      if (dist.estado === 'CONTROLADO' || dist.estado === 'LIQUIDADO') {
        const tControlado = createdAtDate.getTime() + 25 * 60 * 1000;
        historiales.push({
          incidente_id: incidenteId,
          timestamp: tControlado,
          evento_id: `evt_${idStr}_04`,
          estado_anterior: 'EN_COMBATE',
          estado_nuevo: 'CONTROLADO',
          operador_id: operadorAsignado,
          novedad_texto: `Foco ígneo confinado. Sin riesgo de propagación hacia estructuras colindantes.`,
          nivel_agua_actual: 4200,
        });
      }

      if (dist.estado === 'LIQUIDADO') {
        const tLiquidado = createdAtDate.getTime() + 45 * 60 * 1000;
        historiales.push({
          incidente_id: incidenteId,
          timestamp: tLiquidado,
          evento_id: `evt_${idStr}_05`,
          estado_anterior: 'CONTROLADO',
          estado_nuevo: 'LIQUIDADO',
          operador_id: operadorAsignado,
          novedad_texto: `Siniestro sofocado al 100%. Remoción de brasas y enfriamiento con espuma concluido con éxito.`,
          nivel_agua_actual: 1500,
        });
      }

      correlativoGlobal++;
    }
  }

  // Escritura masiva en DynamoDB
  console.log(`Guardando ${incidentes.length} incidentes en tb_incidentes_emergencia...`);
  await batchWriteItems('tb_incidentes_emergencia', incidentes);
  console.log(`✅ ${incidentes.length} incidentes guardados en tb_incidentes_emergencia.`);

  console.log(`\n4/5. Guardando ${historiales.length} registros cronológicos en tb_historial_incidente...`);
  await batchWriteItems('tb_historial_incidente', historiales);
  console.log(`✅ ${historiales.length} eventos históricos guardados en tb_historial_incidente.`);

  console.log(`\n5/5. Guardando ${despachos.length} despachos y ${sagas.length} registros SAGA...`);
  await batchWriteItems('tb_despachos_tacticos', despachos);
  console.log(`✅ ${despachos.length} despachos tácticos guardados en tb_despachos_tacticos.`);

  await batchWriteItems('tb_bitacora_saga', sagas);
  console.log(`✅ ${sagas.length} registros de bitácora SAGA guardados en tb_bitacora_saga.`);

  // 6. REPORTE EJECUTIVO DE EJEMPLO
  console.log('\nCreando reporte ejecutivo consolidado para la Comandancia...');
  await docClient.send(
    new PutCommand({
      TableName: 'tb_reportes_ejecutivos',
      Item: {
        reporte_id: 'rep-0192e3a4-8f12-789a-0099',
        comandante_id: 'usr_op_nataly_001',
        titulo: 'Informe de Situación Operativa y Siniestros sofocados - Santa Cruz 2026',
        comando_voz_origen: 'Generar reporte de contingencias atendidas, consumo de espumógeno y disponibilidad hídrica',
        formatos_disponibles: ['MARKDOWN', 'PDF', 'EXCEL', 'AUDIO'],
        metricas_resumen: {
          total_siniestros: incidentes.length,
          liquidados: 350,
          controlados: 100,
          en_combate: 35,
          despachados: 10,
          pendientes: 5,
          litros_agua_despachados: 1450000,
          litros_espuma_utilizados: 8500,
        },
        archivo_pdf_url: '/descargas/reportes/informe_contingencias_2026.pdf',
        archivo_excel_url: '/descargas/reportes/metricas_contingencias_2026.xlsx',
        archivo_audio_url: '/descargas/reportes/informe_audio_2026.mp3',
        fecha_generacion: new Date().toISOString(),
      },
    }),
  );
  console.log('✅ Reporte ejecutivo consolidado guardado en tb_reportes_ejecutivos.');

  console.log('\n========================================================================');
  console.log('✅ POBLADO COMPLETADO CON ÉXITO:');
  console.log(`   • Usuarios SSO: ${usuarios.length} (1 Admin, 5 Operadores, 15 Bomberos con teléfonos)`);
  console.log(`   • Incidentes: ${incidentes.length} (350 LIQUIDADO, 100 CONTROLADO, 35 EN_COMBATE, 10 DESPACHADO, 5 PENDIENTE)`);
  console.log(`   • Historial Timeline: ${historiales.length} eventos registrados`);
  console.log(`   • Despachos Tácticos: ${despachos.length} unidades vehiculares asignadas`);
  console.log(`   • Bitácora SAGA: ${sagas.length} transacciones distribuidas registradas`);
  console.log('========================================================================');
}

seedData().catch((err) => {
  console.error('❌ Error al poblar seeders en DynamoDB:', err);
  process.exit(1);
});
