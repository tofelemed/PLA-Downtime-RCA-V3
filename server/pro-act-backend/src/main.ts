import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttpApp } from './common/http/configure-http-app';
import { buildV2Document } from './v2/openapi-v2';
import { getProcessRole } from './common/scheduling/process-role';
import { bootstrapWorker } from './worker';


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // SIGTERM/SIGINT run the shutdown hooks (ShutdownCoordinator drains in-flight jobs in role "all")
  app.enableShutdownHooks();

  // Enable CORS - Allow all origins in development, configured origins in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  console.log('🔧 CORS Configuration:');
  console.log(`   Environment: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  
  // CORS configuration - use origin: true directly (simplest and most reliable)
  const corsOptions = {
    origin: isDevelopment 
      ? true  // Allow all origins in development
      : (process.env.CORS_ORIGIN 
          ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
          : true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Correlation-Id', 'X-Tenant-Id', 'X-Client-Audited', 'If-Match', 'Idempotency-Key'],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Correlation-Id', 'Retry-After', 'ETag'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
  
  app.enableCors(corsOptions);
  
  if (isDevelopment) {
    console.log('   CORS: Allowing ALL origins (development mode)');
  } else {
    console.log(`   CORS: Allowing origins: ${Array.isArray(corsOptions.origin) ? corsOptions.origin.join(', ') : 'ALL'}`);
  }

  // /api prefix, URI versioning (/api/v2), API03 error filter, global validation pipe
  configureHttpApp(app);

  // Swagger: v1 at /api (everything except /api/v2), v2 at /api/docs/v2 (V2Module only)
  const v1Config = new DocumentBuilder()
    .setTitle('ProAct API')
    .setDescription('ProAct Backend API Reference (v1)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const v1Document = SwaggerModule.createDocument(app, v1Config);
  v1Document.paths = Object.fromEntries(
    Object.entries(v1Document.paths).filter(([path]) => !path.startsWith('/api/v2/')),
  );
  SwaggerModule.setup('api', app, v1Document);

  const v2Document = buildV2Document(app);
  SwaggerModule.setup('api/docs/v2', app, v2Document);

  // Serve uploaded files. The upload controllers write to "./uploads" relative to the working
  // directory (multer diskStorage), so resolve the same way here rather than relative to the
  // compiled output, whose depth differs between local builds (dist/src) and other layouts.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });



  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log('');
  console.log('✅ Application is running on: http://localhost:' + port);
  console.log('✅ API documentation available at: http://localhost:' + port + '/api (v2: /api/docs/v2)');
  console.log('✅ CORS enabled - Frontend can connect from any origin in development');
  console.log(`✅ Process role: ${getProcessRole()} (schedulers ${getProcessRole() === 'api' ? 'off' : 'on'})`);
  console.log('');
}

// PROCESS_ROLE=worker never serves HTTP; dist/src/worker.js is the dedicated entry for that role
if (getProcessRole() === 'worker') {
  bootstrapWorker();
} else {
  bootstrap();
}
