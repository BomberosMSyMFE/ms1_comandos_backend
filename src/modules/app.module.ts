import { Module, Global } from '@nestjs/common';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../infrastructure/persistence/dynamodb/dynamodb-client.factory';
import { AuthModule } from './auth.module';
import { IncidentesModule } from './incidentes.module';
import { DespachoModule } from './despacho.module';
import { ReportesModule } from './reportes.module';

@Global()
@Module({
  providers: [
    {
      provide: DynamoDBDocumentClient,
      useFactory: () => createDynamoDBClient(),
    },
  ],
  exports: [DynamoDBDocumentClient],
})
class DatabaseModule {}

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    IncidentesModule,
    DespachoModule,
    ReportesModule,
  ],
})
export class AppModule {}
