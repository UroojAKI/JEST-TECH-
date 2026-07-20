import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS Configuration (Restrict to frontend domain)
  app.enableCors({
    origin: ['http://localhost:3000', 'https://jest-policy-crm.com'], // Next.js domains
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 3. Global Prefix and Versioning
  app.setGlobalPrefix('api/v1');

  // 4. API Documentation (Swagger)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('JEST Policy CRM API')
      .setDescription('The API documentation for the enterprise insurance CRM')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
