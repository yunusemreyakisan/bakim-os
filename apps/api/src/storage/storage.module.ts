import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { LocalObjectStorage } from './object-storage';
import { OBJECT_STORAGE, type ObjectStorage } from './storage.port';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): ObjectStorage => new LocalObjectStorage(config.storageRoot),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
