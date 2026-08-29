import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

async function bootstrap() {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error(
      'CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables.',
    );
  }

  const app = await NestFactory.create(AppModule);

  // 0. Cookie Parser — MUST be registered before any route handlers
  //    so req.cookies is populated for the JWT cookieExtractor strategy.
  app.use(cookieParser());

  // 1. Security Headers
  app.use(helmet());

  // 2. Dynamic CORS Configuration (Supports local dev on 3000, 3001, 3002, 3003)
  const isDev = process.env.NODE_ENV !== 'production';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : isDev
      ? [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
        ]
      : [];

  app.enableCors({
    origin: (origin, callback) => {
      // No origin = server-to-server, webhook, CLI, monitoring, native app.
      // These are NOT cross-site browser requests. CORS is a browser mechanism only.
      // Authentication (JWT + RBAC) handles authorization for all non-browser clients.
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        (isDev && origin.startsWith('http://localhost:'))
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type,Accept,Authorization,X-Requested-With,X-Idempotency-Key',
    credentials: true,
  });

  // 3. Global Prefix and Versioning
  app.setGlobalPrefix('api/v1');

  // 4. Global Validation — enables all class-validator decorators across every DTO.
  //    whitelist: strips unknown fields so attackers cannot inject extra properties.
  //    forbidNonWhitelisted: rejects requests with unknown fields (400 not 200).
  //    transform: auto-coerces @Query() strings to typed values (numbers, booleans, enums).
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

  // 5. Global Exception Filter — catches ALL unhandled exceptions.
  //    Prevents Prisma internals, stack traces, and DB schema details
  //    from leaking to clients. Normalises all error responses.
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 6. Global Response Interceptor — wraps every successful response
  //    in a consistent { success, data, meta } envelope.
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalInterceptors(new MetricsInterceptor());

  // 7. API Documentation (Swagger)
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true'
  ) {
    const config = new DocumentBuilder()
      .setTitle('JEST Policy CRM API')
      .setDescription('The API documentation for the enterprise insurance CRM')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(
    `[NestJS API] Server listening on http://localhost:${port}/api/v1`,
  );
}
bootstrap();
