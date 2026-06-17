// core/i18n/i18n.module.ts · global translation service.
import { Global, Module } from '@nestjs/common';
import { TranslationService, I18N_SERVICE } from './translation.service';

@Global()
@Module({
  providers: [TranslationService, { provide: I18N_SERVICE, useExisting: TranslationService }],
  exports: [TranslationService, I18N_SERVICE],
})
export class I18nModule {}
