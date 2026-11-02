import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EnvConfig } from '../../config/env.config';

export function createDynamoDBClient(): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: EnvConfig.awsRegion,
    endpoint: EnvConfig.dynamodbEndpoint,
    credentials: {
      accessKeyId: EnvConfig.awsAccessKeyId,
      secretAccessKey: EnvConfig.awsSecretAccessKey,
    },
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
}
