// core/media/media.module.ts
// Media boundary: presigned direct-to-S3 upload/download with an antivirus scan gate. Self-contained
// module (imported by AppModule). ObjectStore + MediaRepository depend only on core contracts
// (AppConfig, ResilienceService, READ_REPLICA, UNIT_OF_WORK — all global via CoreModule).
import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { ScanWebhookController } from './scan-webhook.controller';
import { MediaService } from './media-links.service';
import { MediaRepository } from './media.repository';
import { ObjectStore, OBJECT_STORE } from './s3-presign.service';

@Module({
  controllers: [MediaController, ScanWebhookController],
  providers: [
    MediaService,
    MediaRepository,
    ObjectStore,
    { provide: OBJECT_STORE, useExisting: ObjectStore },
  ],
  exports: [MediaService, ObjectStore, OBJECT_STORE],
})
export class MediaModule {}
