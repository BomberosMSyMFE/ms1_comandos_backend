import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  ScalarAttributeType,
  KeyType,
  ProjectionType,
} from '@aws-sdk/client-dynamodb';
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

async function initDynamoDB() {
  console.log('--- INICIALIZANDO TABLAS EN DYNAMODB LOCAL ---');

  const { TableNames = [] } = await client.send(new ListTablesCommand({}));

  // 1. tb_incidentes_emergencia
  if (!TableNames.includes('tb_incidentes_emergencia')) {
    console.log('Creando tabla: tb_incidentes_emergencia...');
    await client.send(
      new CreateTableCommand({
        TableName: 'tb_incidentes_emergencia',
        KeySchema: [{ AttributeName: 'incidente_id', KeyType: KeyType.HASH }],
        AttributeDefinitions: [
          { AttributeName: 'incidente_id', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'estado', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'created_at', AttributeType: ScalarAttributeType.S },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI_EstadoFecha',
            KeySchema: [
              { AttributeName: 'estado', KeyType: KeyType.HASH },
              { AttributeName: 'created_at', KeyType: KeyType.RANGE },
            ],
            Projection: { ProjectionType: ProjectionType.ALL },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  }

  // 2. tb_historial_incidente
  if (!TableNames.includes('tb_historial_incidente')) {
    console.log('Creando tabla: tb_historial_incidente...');
    await client.send(
      new CreateTableCommand({
        TableName: 'tb_historial_incidente',
        KeySchema: [
          { AttributeName: 'incidente_id', KeyType: KeyType.HASH },
          { AttributeName: 'timestamp', KeyType: KeyType.RANGE },
        ],
        AttributeDefinitions: [
          { AttributeName: 'incidente_id', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'timestamp', AttributeType: ScalarAttributeType.N },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  }

  // 3. tb_despachos_tacticos
  if (!TableNames.includes('tb_despachos_tacticos')) {
    console.log('Creando tabla: tb_despachos_tacticos...');
    await client.send(
      new CreateTableCommand({
        TableName: 'tb_despachos_tacticos',
        KeySchema: [{ AttributeName: 'despacho_id', KeyType: KeyType.HASH }],
        AttributeDefinitions: [
          { AttributeName: 'despacho_id', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'incidente_id', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'fecha_despacho', AttributeType: ScalarAttributeType.S },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI_IncidenteFecha',
            KeySchema: [
              { AttributeName: 'incidente_id', KeyType: KeyType.HASH },
              { AttributeName: 'fecha_despacho', KeyType: KeyType.RANGE },
            ],
            Projection: { ProjectionType: ProjectionType.ALL },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  }

  // 4. tb_usuarios_sso
  if (!TableNames.includes('tb_usuarios_sso')) {
    console.log('Creando tabla: tb_usuarios_sso...');
    await client.send(
      new CreateTableCommand({
        TableName: 'tb_usuarios_sso',
        KeySchema: [{ AttributeName: 'usuario_id', KeyType: KeyType.HASH }],
        AttributeDefinitions: [
          { AttributeName: 'usuario_id', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'email', AttributeType: ScalarAttributeType.S },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI_Email',
            KeySchema: [{ AttributeName: 'email', KeyType: KeyType.HASH }],
            Projection: { ProjectionType: ProjectionType.ALL },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  }

  // 5. tb_reportes_ejecutivos
  if (!TableNames.includes('tb_reportes_ejecutivos')) {
    console.log('Creando tabla: tb_reportes_ejecutivos...');
    await client.send(
      new CreateTableCommand({
        TableName: 'tb_reportes_ejecutivos',
        KeySchema: [{ AttributeName: 'reporte_id', KeyType: KeyType.HASH }],
        AttributeDefinitions: [
          { AttributeName: 'reporte_id', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'comandante_id', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'fecha_generacion', AttributeType: ScalarAttributeType.S },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI_ComandanteFecha',
            KeySchema: [
              { AttributeName: 'comandante_id', KeyType: KeyType.HASH },
              { AttributeName: 'fecha_generacion', KeyType: KeyType.RANGE },
            ],
            Projection: { ProjectionType: ProjectionType.ALL },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  }

  // 6. tb_bitacora_saga
  if (!TableNames.includes('tb_bitacora_saga')) {
    console.log('Creando tabla: tb_bitacora_saga...');
    await client.send(
      new CreateTableCommand({
        TableName: 'tb_bitacora_saga',
        KeySchema: [
          { AttributeName: 'saga_id', KeyType: KeyType.HASH },
          { AttributeName: 'timestamp', KeyType: KeyType.RANGE },
        ],
        AttributeDefinitions: [
          { AttributeName: 'saga_id', AttributeType: ScalarAttributeType.S },
          { AttributeName: 'timestamp', AttributeType: ScalarAttributeType.N },
          { AttributeName: 'idempotency_key', AttributeType: ScalarAttributeType.S },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI_IdempotencyKey',
            KeySchema: [{ AttributeName: 'idempotency_key', KeyType: KeyType.HASH }],
            Projection: { ProjectionType: ProjectionType.ALL },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  }

  console.log('✅ Las 6 tablas de DynamoDB han sido creadas e inicializadas exitosamente.');
}

initDynamoDB().catch((err) => {
  console.error('❌ Error al inicializar tablas en DynamoDB:', err);
  process.exit(1);
});
