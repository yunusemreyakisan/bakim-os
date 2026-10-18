import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap';
import { APP_CONFIG, type AppConfig } from './config/app-config';

async function main(): Promise<void> {
  const app = await createApp();
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`BakımOS API http://127.0.0.1:${config.port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger http://127.0.0.1:${config.port}/docs`, 'Bootstrap');
}

void main();
