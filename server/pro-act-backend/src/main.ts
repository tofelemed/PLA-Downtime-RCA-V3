import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
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

  // Set global prefix
  app.setGlobalPrefix('api');

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('ProAct API')
    .setDescription('ProAct Backend API Reference')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

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
  console.log('✅ API documentation available at: http://localhost:' + port + '/api');
  console.log('✅ CORS enabled - Frontend can connect from any origin in development');
  console.log('');
}
bootstrap();
