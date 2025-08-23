import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    const startTime = Date.now();

    // Log request
    this.logger.log(
      `${method} ${originalUrl} - ${ip} - ${userAgent}`,
    );

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const { statusCode } = res;

      // Log response
      const logLevel = statusCode >= 400 ? 'error' : 'log';
      const logMessage = `${method} ${originalUrl} - ${statusCode} - ${duration}ms`;

      if (logLevel === 'error') {
        this.logger.error(logMessage);
      } else {
        this.logger.log(logMessage);
      }

      // Call original end method
      originalEnd.call(this, chunk, encoding);
    }.bind(this);

    next();
  }
} 