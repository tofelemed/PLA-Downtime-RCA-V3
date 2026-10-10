import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { redactSecrets } from '../logging/redact';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, ip } = req;
    // query strings may carry secrets; user agents are logged as sent
    const originalUrl = redactSecrets(req.originalUrl);
    const userAgent = req.get('User-Agent') || '';
    const startTime = Date.now();

    // Log request
    this.logger.log(
      `${method} ${originalUrl} - ${ip} - ${userAgent}`,
    );

    // Override res.end to log response
    const originalEnd = res.end.bind(res);
    const logger = this.logger;
    
    res.end = function(chunk?: any, encoding?: any, cb?: () => void): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const { statusCode } = res;

      // Log response
      const logLevel = statusCode >= 400 ? 'error' : 'log';
      const logMessage = `${method} ${originalUrl} - ${statusCode} - ${duration}ms`;

      if (logLevel === 'error') {
        logger.error(logMessage);
      } else {
        logger.log(logMessage);
      }

      // Call original end method with correct context and return the response
      // Handle different overloads
      if (typeof chunk === 'function') {
        return originalEnd(chunk);
      } else if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding);
      } else {
        return originalEnd(chunk, encoding, cb);
      }
    } as typeof res.end;

    next();
  }
} 