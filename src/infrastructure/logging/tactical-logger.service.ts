import { Injectable, LoggerService } from '@nestjs/common';
import { IAppLoggerPort } from '../../application/ports/logger.port';

@Injectable()
export class TacticalLoggerService implements LoggerService, IAppLoggerPort {
  private readonly serviceName = 'MS-01-COMANDOS';

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private colorize(level: string, text: string): string {
    const isTerminal = process.stdout.isTTY ?? true;
    if (!isTerminal) {
      return text;
    }

    switch (level) {
      case 'INFO':
        return `\x1b[32m${text}\x1b[0m`; // Verde
      case 'WARN':
        return `\x1b[33m${text}\x1b[0m`; // Amarillo
      case 'ERROR':
        return `\x1b[31m${text}\x1b[0m`; // Rojo
      case 'DEBUG':
        return `\x1b[36m${text}\x1b[0m`; // Cyan
      case 'VERBOSE':
        return `\x1b[35m${text}\x1b[0m`; // Magenta
      default:
        return text;
    }
  }

  private buildLogLine(
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'VERBOSE',
    context: string,
    message: string,
    meta?: Record<string, any>,
  ): string {
    const ts = this.formatTimestamp();
    const serviceTag = `\x1b[1m\x1b[34m[${this.serviceName}]\x1b[0m`;
    const levelTag = this.colorize(level, `[${level}]`);
    const ctxTag = `\x1b[1m\x1b[36m[${context || 'GENERAL'}]\x1b[0m`;
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

    return `\x1b[2m[${ts}]\x1b[0m ${serviceTag} ${levelTag} ${ctxTag} ${message}${metaStr}`;
  }

  /**
   * Implementación dual:
   * 1. Como Nest LoggerService: log(message, context?)
   * 2. Como IAppLoggerPort: log(context, message, meta?)
   */
  log(messageOrContext: any, ...params: any[]): void {
    const { context, message, meta } = this.parseParams(messageOrContext, params);
    process.stdout.write(this.buildLogLine('INFO', context, message, meta) + '\n');
  }

  warn(messageOrContext: any, ...params: any[]): void {
    const { context, message, meta } = this.parseParams(messageOrContext, params);
    process.stdout.write(this.buildLogLine('WARN', context, message, meta) + '\n');
  }

  error(messageOrContext: any, ...params: any[]): void {
    let context = 'GENERAL';
    let message = '';
    let trace: string | undefined;
    let meta: Record<string, any> | undefined;

    if (params.length >= 1 && typeof messageOrContext === 'string' && typeof params[0] === 'string') {
      // Llamada tipo IAppLoggerPort: error(context, message, trace?, meta?)
      context = messageOrContext;
      message = params[0];
      trace = typeof params[1] === 'string' ? params[1] : undefined;
      meta = typeof params[1] === 'object' ? params[1] : (typeof params[2] === 'object' ? params[2] : undefined);
    } else {
      // Llamada tipo Nest LoggerService: error(message, trace?, context?)
      message = typeof messageOrContext === 'object' ? JSON.stringify(messageOrContext) : String(messageOrContext);
      trace = params[0];
      context = params[1] || 'GENERAL';
    }

    process.stderr.write(this.buildLogLine('ERROR', context, message, meta) + '\n');
    if (trace) {
      process.stderr.write(`\x1b[31m${trace}\x1b[0m\n`);
    }
  }

  debug(messageOrContext: any, ...params: any[]): void {
    const { context, message, meta } = this.parseParams(messageOrContext, params);
    process.stdout.write(this.buildLogLine('DEBUG', context, message, meta) + '\n');
  }

  verbose(messageOrContext: any, ...params: any[]): void {
    const { context, message, meta } = this.parseParams(messageOrContext, params);
    process.stdout.write(this.buildLogLine('VERBOSE', context, message, meta) + '\n');
  }

  /**
   * Registra un bloque táctico visual en consola para despliegue
   */
  logBanner(lines: string[]): void {
    const border = '═'.repeat(78);
    process.stdout.write(`\x1b[1m\x1b[36m╔${border}╗\x1b[0m\n`);
    for (const line of lines) {
      const padded = line.padEnd(76, ' ');
      process.stdout.write(`\x1b[1m\x1b[36m║  \x1b[0m${padded}\x1b[1m\x1b[36m║\x1b[0m\n`);
    }
    process.stdout.write(`\x1b[1m\x1b[36m╚${border}╝\x1b[0m\n`);
  }

  private parseParams(first: any, rest: any[]): { context: string; message: string; meta?: Record<string, any> } {
    if (rest.length >= 1 && typeof first === 'string' && typeof rest[0] === 'string') {
      const isFirstTag = /^[A-Za-z0-9_:-]+$/.test(first.trim());
      const isSecondTag = /^[A-Za-z0-9_:-]+$/.test(rest[0].trim());

      // Si el primer parámetro es un tag (sin espacios) y el segundo es mensaje (con espacios)
      if (isFirstTag && !isSecondTag) {
        return {
          context: first,
          message: rest[0],
          meta: typeof rest[1] === 'object' ? rest[1] : undefined,
        };
      }

      // Si el segundo parámetro es un tag y el primero tiene espacios (patrón nativo NestJS: log(message, context))
      if (!isFirstTag && isSecondTag) {
        return {
          context: rest[0],
          message: first,
          meta: typeof rest[1] === 'object' ? rest[1] : undefined,
        };
      }

      // Si ambos tienen forma de tag o de texto libre, verificar si hay metadatos
      if (typeof rest[1] === 'object') {
        return {
          context: first,
          message: rest[0],
          meta: rest[1],
        };
      }
    }

    // Nest LoggerService: (message, context?)
    const message = typeof first === 'object' ? JSON.stringify(first) : String(first);
    const context = typeof rest[0] === 'string' ? rest[0] : 'GENERAL';
    const meta = typeof rest[1] === 'object' ? rest[1] : undefined;

    return { context, message, meta };
  }
}
