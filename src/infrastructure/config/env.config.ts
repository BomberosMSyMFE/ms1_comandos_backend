import * as dotenv from 'dotenv';
dotenv.config();

export const EnvConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  dynamodbEndpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fakeLocalKeyId',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fakeLocalAccessKey',
  jwtSecret: process.env.JWT_SECRET || 'super_secreto_bomberos_jwt_key_nataly_2026_uagrm',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  cookieName: process.env.COOKIE_NAME || 'token_sesion',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'strict',
  ms02FlotasUrl: process.env.MS02_FLOTAS_URL || 'http://localhost:8082',
  ms03InventarioUrl: process.env.MS03_INVENTARIO_GRAPHQL_URL || 'http://localhost:8083/graphql',
  useMocks: process.env.USE_MOCKS !== 'false',
};
