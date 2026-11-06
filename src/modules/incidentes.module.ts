import { Module } from '@nestjs/common';
import { IncidentesController } from '../infrastructure/controllers/incidentes.controller';
import { DynamoDbIncidenteRepository } from '../infrastructure/persistence/dynamodb/dynamodb-incidente.repository';
import { DynamoDbHistorialRepository } from '../infrastructure/persistence/dynamodb/dynamodb-historial.repository';
import { DynamoDbDespachoRepository } from '../infrastructure/persistence/dynamodb/dynamodb-despacho.repository';
import { SalaCrisisGateway } from '../infrastructure/websockets/sala-crisis.gateway';
import { RegistrarIncidenteUseCase } from '../application/use-cases/registrar-incidente.use-case';
import { CambiarEstadoIncidenteUseCase } from '../application/use-cases/cambiar-estado-incidente.use-case';
import { ListarIncidentesActivosUseCase } from '../application/use-cases/listar-incidentes-activos.use-case';
import { ObtenerTimelineIncidenteUseCase } from '../application/use-cases/obtener-timeline-incidente.use-case';
import { ObtenerDespachosIncidenteUseCase } from '../application/use-cases/obtener-despachos-incidente.use-case';
import { ObtenerKpisTacticosUseCase } from '../application/use-cases/obtener-kpis-tacticos.use-case';

@Module({
  controllers: [IncidentesController],
  providers: [
    DynamoDbIncidenteRepository,
    DynamoDbHistorialRepository,
    DynamoDbDespachoRepository,
    SalaCrisisGateway,
    {
      provide: RegistrarIncidenteUseCase,
      useFactory: (
        incRepo: DynamoDbIncidenteRepository,
        histRepo: DynamoDbHistorialRepository,
        notifier: SalaCrisisGateway,
      ) => new RegistrarIncidenteUseCase(incRepo, histRepo, notifier),
      inject: [DynamoDbIncidenteRepository, DynamoDbHistorialRepository, SalaCrisisGateway],
    },
    {
      provide: CambiarEstadoIncidenteUseCase,
      useFactory: (
        incRepo: DynamoDbIncidenteRepository,
        histRepo: DynamoDbHistorialRepository,
        notifier: SalaCrisisGateway,
      ) => new CambiarEstadoIncidenteUseCase(incRepo, histRepo, notifier),
      inject: [DynamoDbIncidenteRepository, DynamoDbHistorialRepository, SalaCrisisGateway],
    },
    {
      provide: ListarIncidentesActivosUseCase,
      useFactory: (incRepo: DynamoDbIncidenteRepository) =>
        new ListarIncidentesActivosUseCase(incRepo),
      inject: [DynamoDbIncidenteRepository],
    },
    {
      provide: ObtenerKpisTacticosUseCase,
      useFactory: (incRepo: DynamoDbIncidenteRepository) =>
        new ObtenerKpisTacticosUseCase(incRepo),
      inject: [DynamoDbIncidenteRepository],
    },
    {
      provide: ObtenerTimelineIncidenteUseCase,
      useFactory: (histRepo: DynamoDbHistorialRepository) =>
        new ObtenerTimelineIncidenteUseCase(histRepo),
      inject: [DynamoDbHistorialRepository],
    },
    {
      provide: ObtenerDespachosIncidenteUseCase,
      useFactory: (despRepo: DynamoDbDespachoRepository) =>
        new ObtenerDespachosIncidenteUseCase(despRepo),
      inject: [DynamoDbDespachoRepository],
    },
  ],
  exports: [
    DynamoDbIncidenteRepository,
    DynamoDbHistorialRepository,
    DynamoDbDespachoRepository,
    SalaCrisisGateway,
    ObtenerKpisTacticosUseCase,
  ],
})
export class IncidentesModule {}
