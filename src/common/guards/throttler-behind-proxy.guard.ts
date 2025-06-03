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
  protected getIp(req: Record<string, unknown>): string {
    // Check if ips exists and is an array with elements
    const ips = req.ips as string[] | undefined;
    if (Array.isArray(ips) && ips.length > 0) {
      return ips[0];
    }
    // Fall back to ip
    return (req.ip as string) || '127.0.0.1';
  }
}
