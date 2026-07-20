import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';
import { StructuredLoggerService } from './common/logger/structured-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const logger = new StructuredLoggerService();
  logger.setContext('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLoggerService(),
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Security headers
  app.use(helmet());

  // Enable CORS with allowlist
  const configService = app.get(ConfigService);
  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3001')
    .split(',');
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  });

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Configuration — development only
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('JEST Policy CRM API')
      .setDescription('Official API documentation for JEST Policy CRM')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = configService.get<number>('app.port', 3000);

  await app.listen(port);

  logger.log('');
  logger.log('=======================================');
  logger.log(' JEST Policy CRM API Started');
  logger.log('=======================================');
  logger.log(` API : http://localhost:${port}/api/v1`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(` Docs: http://localhost:${port}/api`);
  }
  logger.log('=======================================');
}

bootstrap();
