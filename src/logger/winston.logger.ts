import { Logger, QueryRunner } from 'typeorm';
import { createLogger, format, transports } from 'winston';
import httpContext from 'express-http-context';
import { SPLAT } from 'triple-beam';
import { ConfigService } from '@nestjs/config';

enum Colors {
  Reset = '\x1b[0m',
  Black = '\x1b[30m',
  Red = '\x1b[31m',
  Green = '\x1b[32m',
  Yellow = '\x1b[33m',
  Blue = '\x1b[34m',
  Magenta = '\x1b[35m',
  Cyan = '\x1b[36m',
  White = '\x1b[37m',
}

// Increase the limit to capture more stack frames
Error.stackTraceLimit = 22;

// Utility to apply colors
const colorize = (text: string, color: string): string => {
  return `${color}${text}${Colors.Reset}`;
};

const formatObject = (param: any) => {
  try {
    if (typeof param === 'object') {
      return JSON.stringify(param);
    }
  } catch (e) {
    console.error(e);
  }
  return param;
};

const all = format((info) => {
  const splat: any = info[SPLAT] || [];
  const message = formatObject(info.message);
  const rest = splat.map(formatObject).join(' ');
  info.message = `${message} ${rest}`;
  return info;
});

// custom log display format
const customFormat = (
  timestampClr?: Colors,
  levelClr?: Colors,
  messageClr?: Colors,
) =>
  format.printf(({ timestamp, level, message }) => {
    const levelColors: Record<string, string> = {
      error: Colors.Red,
      warn: Colors.Yellow,
      info: Colors.Cyan,
      debug: Colors.Green,
      verbose: Colors.Magenta,
    };

    const levelColor = levelClr || levelColors[level] || Colors.White;
    const levelText = colorize(level, levelColor);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    let innerMessage = message as any;
    if (
      innerMessage.message &&
      innerMessage.stack &&
      typeof innerMessage === 'object'
    ) {
      innerMessage = `${innerMessage.message} : ${innerMessage.stack}`;
    }

    // Different color for messages
    const coloredMessage = colorize(
      formatObject(innerMessage),
      messageClr || Colors.White,
    );

    const timestampText = colorize(
      `[${timestamp}]` as any,
      timestampClr || Colors.Yellow,
    );

    const stack = new Error().stack;

    return `${timestampText} ${levelText} [${httpContext.get('reqId')}] : ${coloredMessage}`;
  });

const devLogger = {
  level: 'debug',
  format: format.combine(
    all(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    customFormat(Colors.Yellow, Colors.White, Colors.Green),
  ),
  transports: [new transports.Console()],
};

export const appLogger = createLogger(devLogger);

export class MyCustomLogger implements Logger {
  constructor(private configService: ConfigService) {}
  logQuerySlow(
    time: number,
    query: string,
    parameters?: any[] | undefined,
    queryRunner?: QueryRunner | undefined,
  ) {
    throw new Error('Method not implemented.');
  }

  /**
   * Write log to specific output.
   */

  logQuery(query: string, parameters?: any[]) {
    if (query && query.includes('WHERE')) {
      const whereStatement = query.split('WHERE')[1];
      const regexMatch = whereStatement.match(/`\w+`/);
      let tableName = 'tableName';
      if (regexMatch && regexMatch.length > 0) {
        tableName = regexMatch[0].split('`')[1];
      }
      const subQuery = `SELECT * FROM ${tableName}  WHERE ${whereStatement}`;
      appLogger.info({
        label: 'db-query',
        message: `${subQuery} - [${parameters ?? ''}]`,
      });
    } else {
      appLogger.info({ label: 'db-query', message: `${query}` });
    }
  }

  logQueryError(error: string | Error, query: string, parameters?: any[]) {
    appLogger.error({
      label: 'db-query-error',
      message: `ERROR DB QUERY: ${query} - [${parameters ?? ''}] - error: ${error}`,
    });
  }

  logMigration(message: string) {
    appLogger.info({ label: `db-query`, message });
  }

  logSchemaBuild(message: string) {
    appLogger.info({ label: 'db-query', message });
  }

  log(level: 'log' | 'info' | 'warn', message: any) {
    appLogger.log({ level, label: 'db-query', message });
  }
}
