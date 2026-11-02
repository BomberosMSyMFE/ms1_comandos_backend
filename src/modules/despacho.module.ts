import { Module } from '@nestjs/common';
import { DespachoController } from '../infrastructure/controllers/despacho.controller';
import { IncidentesModule } from './incidentes.module';
import { DynamoDbSagaLogRepository } from '../infrastructure/persistence/dynamodb/dynamodb-saga-log.repository';
import { DynamoDbIncidenteRepository } from '../infrastructure/persistence/dynamodb/dynamodb-incidente.repository';
import { DynamoDbDespachoRepository } from '../infrastructure/persistence/dynamodb/dynamodb-despacho.repository';
import { DynamoDbHistorialRepository } from '../infrastructure/persistence/dynamodb/dynamodb-historial.repository';
import { SalaCrisisGateway } from '../infrastructure/websockets/sala-crisis.gateway';
import { MockFlotasClient } from '../infrastructure/external-clients/flotas/mock-flotas.client';
import { HttpFlotasClient } from '../infrastructure/external-clients/flotas/http-flotas.client';
import { MockInventarioClient } from '../infrastructure/external-clients/inventario/mock-inventario.client';
import { GraphqlInventarioClient } from '../infrastructure/external-clients/inventario/graphql-inventario.client';
import { DespacharEmergenciaUseCase } from '../application/use-cases/despachar-emergencia.use-case';
import { EnvConfig } from '../infrastructure/config/env.config';

@Module({
  imports: [IncidentesModule],
  controllers: [DespachoController],
  providers: [
    DynamoDbSagaLogRepository,
    MockFlotasClient,
    HttpFlotasClient,
    MockInventarioClient,
    GraphqlInventarioClient,
    {
      provide: 'IFlotasClientPort',
      useClass: EnvConfig.useMocks ? MockFlotasClient : HttpFlotasClient,
    },
    {
      provide: 'IInventarioClientPort',
      useClass: EnvConfig.useMocks ? MockInventarioClient : GraphqlInventarioClient,
    },
    {
      provide: DespacharEmergenciaUseCase,
      useFactory: (
        incRepo: DynamoDbIncidenteRepository,
        despRepo: DynamoDbDespachoRepository,
        histRepo: DynamoDbHistorialRepository,
        sagaRepo: DynamoDbSagaLogRepository,
        flotasClient: any,
        invClient: any,
        notifier: SalaCrisisGateway,
      ) =>
        new DespacharEmergenciaUseCase(
          incRepo,
          despRepo,
          histRepo,
          sagaRepo,
          flotasClient,
          invClient,
          notifier,
        ),
      inject: [
        DynamoDbIncidenteRepository,
        DynamoDbDespachoRepository,
        DynamoDbHistorialRepository,
        DynamoDbSagaLogRepository,
        'IFlotasClientPort',
        'IInventarioClientPort',
        SalaCrisisGateway,
      ],
    },
  ],
  exports: [DespacharEmergenciaUseCase, DynamoDbSagaLogRepository],
})
export class DespachoModule {}
