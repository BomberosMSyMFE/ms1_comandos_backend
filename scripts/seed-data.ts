import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
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

async function seedData() {
  console.log('--- POBLANDO DATOS DE PRUEBA (SEEDERS) PARA MS-01 COMANDOS ---');

  // 1. Usuarios SSO
  console.log('Creando usuarios SSO iniciales...');
  const passNataly = await bcrypt.hash('Comandos2026!', 12);
  const passBombero = await bcrypt.hash('Bombero2026!', 12);
  const passAdmin = await bcrypt.hash('AdminSeguro2026!', 12);

  const usuarios = [
    {
      usuario_id: 'usr_0192e3a4-8f12-789a-bcde-000000000001',
      nombre_completo: 'Nataly Martínez (Comandancia / Despacho)',
      email: 'nataly.comandos@bomberos.gob.bo',
      password_hash: passNataly,
      rol: 'OPERADOR',
      estacion_base: 'Estación Central - Santa Cruz',
      activo: true,
      created_at: new Date().toISOString(),
    },
    {
      usuario_id: 'usr_0192e3a4-8f12-789a-bcde-000000000002',
      nombre_completo: 'Bombero Conductor (Cisterna B-04)',
      email: 'bombero.b04@bomberos.gob.bo',
      password_hash: passBombero,
      rol: 'BOMBERO',
      estacion_base: 'Estación Central - Santa Cruz',
      activo: true,
      created_at: new Date().toISOString(),
    },
    {
      usuario_id: 'usr_0192e3a4-8f12-789a-bcde-000000000003',
      nombre_completo: 'Admin General del Sistema',
      email: 'admin@bomberos.gob.bo',
      password_hash: passAdmin,
      rol: 'ADMINISTRADOR',
      estacion_base: 'Cuartel General',
      activo: true,
      created_at: new Date().toISOString(),
    },
  ];

  for (const u of usuarios) {
    await docClient.send(
      new PutCommand({
        TableName: 'tb_usuarios_sso',
        Item: u,
      }),
    );
  }

  // 2. Incidentes de Prueba (Santa Cruz de la Sierra)
  console.log('Creando incidentes de prueba...');
  const incidentes = [
    {
      incidente_id: '0192e3a4-8f12-789a-bcde-000000000001',
      codigo_radial: 'INC-2026-SCZ-001',
      tipo_incidente: 'QUIMICO',
      severidad: 'CRITICA',
      descripcion: 'Derrame de solvente inflamable con combustión activa en galpón industrial 4.',
      estado: 'PENDIENTE',
      ubicacion: {
        lat: -17.7654,
        lng: -63.1432,
        dir: 'Parque Industrial PI-27, Santa Cruz',
        zona_cuadrante: 'Cuadrante Norte',
      },
      unidades_asignadas: 0,
      operador_id: 'usr_0192e3a4-8f12-789a-bcde-000000000001',
      denunciante: {
        nombre: 'Ing. Carlos Suarez (Seguridad Industrial)',
        telefono: '+591 78912345',
      },
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      incidente_id: '0192e3a4-8f12-789a-bcde-000000000002',
      codigo_radial: 'INC-2026-SCZ-002',
      tipo_incidente: 'ESTRUCTURAL',
      severidad: 'ALTA',
      descripcion: 'Incendio en segundo nivel de edificio comercial con riesgo de propagación.',
      estado: 'EN_COMBATE',
      ubicacion: {
        lat: -17.7712,
        lng: -63.1815,
        dir: '2do Anillo y Av. Monseñor Rivero',
        zona_cuadrante: 'Cuadrante Centro',
      },
      unidades_asignadas: 1,
      operador_id: 'usr_0192e3a4-8f12-789a-bcde-000000000001',
      created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ];

  for (const inc of incidentes) {
    await docClient.send(
      new PutCommand({
        TableName: 'tb_incidentes_emergencia',
        Item: inc,
      }),
    );
  }

  // 3. Despacho inicial para Incidente 2
  console.log('Creando asignación de unidad táctica para Incidente 2...');
  await docClient.send(
    new PutCommand({
      TableName: 'tb_despachos_tacticos',
      Item: {
        despacho_id: 'desp_0192e3a4-8f12-789a-0001',
        incidente_id: '0192e3a4-8f12-789a-bcde-000000000002',
        camion_id: 'CAM-B02',
        conductor_id: 'usr_0192e3a4-8f12-789a-bcde-000000000002',
        operador_autoriza: 'usr_0192e3a4-8f12-789a-bcde-000000000001',
        estado_despacho: 'EN_ESCENA',
        insumos_asociados: [
          { insumoId: 'INS-ESPUMA-AFFF', nombre: 'Espuma Química AFFF', cantidad: 150 },
          { insumoId: 'INS-TRAJE-CLASE-A', nombre: 'Traje Autónomo Nivel A', cantidad: 2 },
        ],
        fecha_despacho: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        hora_arribo: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
      },
    }),
  );

  // 4. Historial para Incidente 2
  console.log('Creando historial de eventos...');
  const novedades = [
    {
      incidente_id: '0192e3a4-8f12-789a-bcde-000000000002',
      timestamp: Date.now() - 40 * 60 * 1000,
      evento_id: 'evt_001',
      estado_anterior: null,
      estado_nuevo: 'PENDIENTE',
      operador_id: 'usr_0192e3a4-8f12-789a-bcde-000000000001',
      novedad_texto: 'Alarma de incendio recibida por reporte ciudadano vía WhatsApp bot.',
    },
    {
      incidente_id: '0192e3a4-8f12-789a-bcde-000000000002',
      timestamp: Date.now() - 35 * 60 * 1000,
      evento_id: 'evt_002',
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'DESPACHADO',
      operador_id: 'usr_0192e3a4-8f12-789a-bcde-000000000001',
      novedad_texto: 'Comandante Nataly aprobó despacho táctico. SAGA orquestada con éxito.',
    },
    {
      incidente_id: '0192e3a4-8f12-789a-bcde-000000000002',
      timestamp: Date.now() - 28 * 60 * 1000,
      evento_id: 'evt_003',
      estado_anterior: 'DESPACHADO',
      estado_nuevo: 'EN_COMBATE',
      operador_id: 'usr_0192e3a4-8f12-789a-bcde-000000000001',
      novedad_texto: 'Unidad CAM-B02 arribó a la escena. Presurización de mangueras iniciada.',
      nivel_agua_actual: 9500,
    },
  ];

  for (const n of novedades) {
    await docClient.send(
      new PutCommand({
        TableName: 'tb_historial_incidente',
        Item: n,
      }),
    );
  }

  // 5. Reporte Ejecutivo de Ejemplo (CU-07)
  console.log('Creando reporte ejecutivo de prueba...');
  await docClient.send(
    new PutCommand({
      TableName: 'tb_reportes_ejecutivos',
      Item: {
        reporte_id: 'rep-0192e3a4-8f12-789a-0099',
        comandante_id: 'usr_0192e3a4-8f12-789a-bcde-000000000001',
        titulo: 'Informe de Situación Operativa - Octubre 2026',
        comando_voz_origen: 'Generar informe consolidado de los siniestros atendidos esta semana y consumo de espumógeno',
        formatos_disponibles: ['MARKDOWN', 'PDF', 'EXCEL', 'AUDIO'],
        metricas_resumen: {
          total_siniestros: 8,
          controlados: 7,
          en_curso: 1,
          litros_agua_despachados: 45000,
          litros_espuma_utilizados: 850,
        },
        archivo_pdf_url: '/descargas/reportes/informe_octubre_2026.pdf',
        archivo_excel_url: '/descargas/reportes/metricas_octubre_2026.xlsx',
        archivo_audio_url: '/descargas/reportes/resumen_octubre_2026.mp3',
        fecha_generacion: new Date().toISOString(),
      },
    }),
  );

  console.log('✅ Base de datos local poblada exitosamente con usuarios, incidentes y reportes.');
}

seedData().catch((err) => {
  console.error('❌ Error al poblar seeders en DynamoDB:', err);
  process.exit(1);
});
