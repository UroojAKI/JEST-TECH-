import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';
import { correlationStorage } from './correlation.context';

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService extends ConsoleLogger {
  protected formatMessage(
    logLevel: string,
    message: any,
    formattedLogLevel: string,
    context?: string,
  ): string {
    const correlationId = correlationStorage.getStore() || 'system';
    const timestamp = new Date().toISOString();

    const logObject: any = {
      timestamp,
      level: logLevel.toUpperCase(),
      correlationId,
      context: context || this.context || 'App',
    };

    if (message && typeof message === 'object') {
      Object.assign(logObject, message);
      if (message.message !== undefined) {
        logObject.message =
          typeof message.message === 'object'
            ? JSON.stringify(message.message)
            : String(message.message);
      }
    } else {
      logObject.message = String(message);
    }

    // Output clean JSON format in structured environments
    return JSON.stringify(logObject);
  }

  // Override printing to bypass ConsoleLogger's ANSI/color terminal outputs
  protected printMessages(
    messages: any[],
    context?: string,
    logLevel?: string,
    writeStreamType?: 'stdout' | 'stderr',
  ) {
    messages.forEach((message) => {
      const formattedMessage = this.formatMessage(
        logLevel || 'log',
        message,
        '',
        context,
      );
      if (writeStreamType === 'stderr' || logLevel === 'error') {
        process.stderr.write(formattedMessage + '\n');
      } else {
        process.stdout.write(formattedMessage + '\n');
      }
    });
  }
}
