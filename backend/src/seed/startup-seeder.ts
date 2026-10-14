import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/config';
import { SeedService } from './seed.service';

@Injectable()
export class StartupSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupSeeder.name);

  constructor(
    @Inject(SeedService) private readonly seed: SeedService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.seed.onStart) return;
    const summary = await this.seed.seedAll();
    this.logger.log(`seed ensured: ${JSON.stringify(summary)}`);
  }
}
