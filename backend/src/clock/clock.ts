import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Business clock: drives order/return/coupon timestamps and can be shifted or frozen by tests.
 * It must NEVER be used to validate request signatures/timestamps - see AuthClock.
 * Infrastructure timing (worker leases, retry scheduling, token hashing) uses real system time.
 */
export abstract class BusinessClock {
  abstract now(): Date;
}

/**
 * Clock for request-signature / timestamp validation (Phase 03+). Always real system time and
 * deliberately NOT adjustable through /test-admin/clock, so shifting the business clock
 * cannot make an expired or forged signature look valid.
 */
export abstract class AuthClock {
  abstract now(): Date;
}

@Injectable()
export class SystemAuthClock extends AuthClock {
  now(): Date {
    return new Date();
  }
}

export interface ClockSnapshot {
  now: string;
  systemNow: string;
  offsetMs: number;
  frozen: boolean;
  frozenAt: string | null;
}

@Injectable()
export class PersistentBusinessClock extends BusinessClock implements OnModuleInit {
  private offsetMs = 0;
  private frozenAt: Date | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const row = await this.prisma.clockState.findUnique({ where: { id: 1 } });
    this.offsetMs = row ? Number(row.offsetMs) : 0;
    this.frozenAt = row?.frozenAt ?? null;
  }

  now(): Date {
    return this.frozenAt ? new Date(this.frozenAt) : new Date(Date.now() + this.offsetMs);
  }

  snapshot(): ClockSnapshot {
    return {
      now: this.now().toISOString(),
      systemNow: new Date().toISOString(),
      offsetMs: this.offsetMs,
      frozen: this.frozenAt !== null,
      frozenAt: this.frozenAt ? this.frozenAt.toISOString() : null,
    };
  }

  private async persist(): Promise<void> {
    await this.prisma.clockState.upsert({
      where: { id: 1 },
      create: { id: 1, offsetMs: BigInt(this.offsetMs), frozenAt: this.frozenAt },
      update: { offsetMs: BigInt(this.offsetMs), frozenAt: this.frozenAt },
    });
  }

  async setTo(target: Date, freeze = false): Promise<ClockSnapshot> {
    this.offsetMs = target.getTime() - Date.now();
    this.frozenAt = freeze ? target : null;
    await this.persist();
    return this.snapshot();
  }

  async advance(ms: number): Promise<ClockSnapshot> {
    if (this.frozenAt) this.frozenAt = new Date(this.frozenAt.getTime() + ms);
    else this.offsetMs += ms;
    await this.persist();
    return this.snapshot();
  }

  async reset(): Promise<ClockSnapshot> {
    this.offsetMs = 0;
    this.frozenAt = null;
    await this.persist();
    return this.snapshot();
  }
}
