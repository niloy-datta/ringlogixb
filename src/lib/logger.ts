export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  orgId?: string;
  userId?: string;
  requestId?: string;
  deviceId?: string;
  deliveryId?: string;
  [key: string]: unknown;
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...context,
    });
  }

  debug(message: string, context?: LogContext) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatLog('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorDetails =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : { error };

    console.error(
      this.formatLog('error', message, {
        ...context,
        ...errorDetails,
      })
    );
  }
}

export const logger = new Logger();
