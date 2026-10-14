import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { APP_CONFIG, AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }
    for (const [name, dir] of [['media', this.config.mediaDir], ['pdf', this.config.pdfDir]] as const) {
      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.access(dir, (await import('fs')).constants.W_OK);
        checks[name] = 'writable';
      } catch {
        checks[name] = 'unwritable';
      }
    }
    const ok = checks.database === 'up' && checks.media === 'writable' && checks.pdf === 'writable';
    if (!ok) throw new ServiceUnavailableException({ status: 'unavailable', checks });
    return { status: 'ok', checks };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
