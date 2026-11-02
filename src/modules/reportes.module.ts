import { Module } from '@nestjs/common';
import { ReportesController } from '../infrastructure/controllers/reportes.controller';
import { DynamoDbReporteRepository } from '../infrastructure/persistence/dynamodb/dynamodb-reporte.repository';

@Module({
  controllers: [ReportesController],
  providers: [DynamoDbReporteRepository],
  exports: [DynamoDbReporteRepository],
})
export class ReportesModule {}
