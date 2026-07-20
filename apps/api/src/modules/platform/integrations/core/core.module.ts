import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProviderRegistryService } from './services/provider-registry/provider-registry.service';
import { IntegrationHttpClient } from './services/integration-http/integration-http.service';

@Module({
  imports: [HttpModule],
  providers: [ProviderRegistryService, IntegrationHttpClient],
  exports: [ProviderRegistryService, IntegrationHttpClient],
})
export class CoreModule {}
