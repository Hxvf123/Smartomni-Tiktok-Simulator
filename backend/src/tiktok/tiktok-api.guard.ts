import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { App, Shop, Token } from '@prisma/client';
import type { Request } from 'express';
import { AuthClock } from '../clock/clock';
import { TiktokFault } from '../common/tiktok-fault';
import { APP_CONFIG, AppConfig } from '../config/config';
import { OAuthService } from '../oauth/oauth.service';
import { computeApiSignature, parseRawQuery, signatureMatches } from './signature';

export const REQUIRED_SCOPE = 'tiktok:required-scope';
/** Declares the (simulator placeholder) scope an operation needs; checked against the token's GRANTED scopes. */
export const RequireScope = (scope: string) => SetMetadata(REQUIRED_SCOPE, scope);

export interface TiktokPrincipal {
  app: App;
  token: Token;
  shop: Shop;
}
export type TiktokRequest = Request & { tiktok?: TiktokPrincipal; shopId?: string; requestId?: string; rawBody?: Buffer };

/**
 * Authentication for shop-level TikTok-shaped APIs. Order: required params -> app_key -> timestamp (AuthClock) ->
 * signature -> access token (expiry/revocation) -> token belongs to the app -> scope -> shop_cipher (if sent).
 * There is no simulator-only bypass: the same checks run for every caller.
 * All failures are simulator test faults (TikTok error codes are undocumented).
 */
@Injectable()
export class TiktokApiGuard implements CanActivate {
  constructor(
    @Inject(OAuthService) private readonly oauth: OAuthService,
    @Inject(AuthClock) private readonly clock: AuthClock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<TiktokRequest>();
    const parsed = parseRawQuery(req.originalUrl);
    if (!parsed) throw new TiktokFault(400, 'invalid_input', 'repeated query parameter');
    const { path, query } = parsed;
    const rawAccess = req.header('x-tts-access-token');
    if (!query.app_key || !query.timestamp || !query.sign || !rawAccess) {
      throw new TiktokFault(400, 'invalid_input', 'app_key, timestamp, sign and the x-tts-access-token header are required');
    }

    const app = await this.oauth.findAppByKey(query.app_key);
    if (!app) throw new TiktokFault(401, 'unknown_app_key', 'app_key is not recognised');

    // Timestamps are Unix SECONDS (unit and tolerance unverified); stale AND future values are rejected.
    if (!/^\d{1,12}$/.test(query.timestamp)) throw new TiktokFault(400, 'invalid_input', 'timestamp must be Unix seconds');
    const skewMs = Math.abs(this.clock.now().getTime() - Number(query.timestamp) * 1000);
    if (skewMs > this.config.oauth.signatureWindowMs) throw new TiktokFault(401, 'stale_timestamp', 'timestamp is outside the accepted window');

    const expected = computeApiSignature(app.appSecret, path, query, req.rawBody ? req.rawBody.toString('utf8') : '');
    if (!signatureMatches(expected, query.sign)) throw new TiktokFault(401, 'bad_signature', 'signature does not match');

    const token = await this.oauth.authenticateAccessToken(rawAccess);
    if (token.appId !== app.id) throw new TiktokFault(403, 'token_invalid', 'access token was not issued to this app_key');
    req.shopId = token.shopId; // for the HTTP log; never taken from client input

    const scope = this.reflector.get<string | undefined>(REQUIRED_SCOPE, ctx.getHandler());
    if (scope && !token.scopes.includes(scope)) throw new TiktokFault(403, 'missing_scope', `the authorization does not grant ${scope}`);

    // shop_cipher is optional on shop-listing calls; when present it must be this token's shop (token isolation).
    if (query.shop_cipher !== undefined && query.shop_cipher !== token.shop.shopCipher) {
      throw new TiktokFault(403, 'shop_cipher_mismatch', 'shop_cipher does not belong to the shop of this access token');
    }
    req.tiktok = { app, token, shop: token.shop };
    return true;
  }
}
