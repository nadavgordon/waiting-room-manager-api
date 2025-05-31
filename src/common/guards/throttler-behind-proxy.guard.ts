import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * @file ThrottlerBehindProxyGuard
 * @description Custom ThrottlerGuard to correctly identify client IP when behind a proxy (e.g., Nginx, Load Balancer).
 * It overrides the `getIp` method to extract the IP from the `X-Forwarded-For` header,
 * falling back to the standard IP if the header is not present.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  /**
   * @description Overrides the default `getIp` method to support proxies.
   * @param req The incoming request object.
   * @returns The client's IP address.
   */
  protected getIp(req: Record<string, any>): string {
    return req.ips?.length ? req.ips[0] : req.ip;
  }
}