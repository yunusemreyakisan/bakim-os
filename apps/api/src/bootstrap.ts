import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);
  if (config.trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: number) => void;
    };
    expressApp.set('trust proxy', 1);
  }
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Bootstrap-Token'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('BakımOS API')
      .setDescription('Fabrika bakım operasyonları için sürüm 1 REST API.')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Tenant-Id' }, 'tenant-id')
      .addCookieAuth('bakimos_rt')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
  return app;
}
