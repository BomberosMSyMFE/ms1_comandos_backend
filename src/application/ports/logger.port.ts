export interface IAppLoggerPort {
  log(context: string, message: string, meta?: Record<string, any>): void;
  warn(context: string, message: string, meta?: Record<string, any>): void;
  error(context: string, message: string, trace?: string, meta?: Record<string, any>): void;
  debug?(context: string, message: string, meta?: Record<string, any>): void;
}
