import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TacticalLoggerService } from './tactical-logger.service';
import { TacticalLoggingInterceptor } from './tactical-logging.interceptor';

@Global()
@Module({
  providers: [
    TacticalLoggerService,
    TacticalLoggingInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: TacticalLoggingInterceptor,
    },
    {
      provide: 'IAppLoggerPort',
      useExisting: TacticalLoggerService,
    },
  ],
  exports: [TacticalLoggerService, TacticalLoggingInterceptor, 'IAppLoggerPort'],
})
export class LoggingModule {}
