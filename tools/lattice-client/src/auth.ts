import { resolveScope } from './config';
import { LatticeConfig, LatticeError } from './types';

/** Supplies an Entra bearer token for the Lattice audience. */
export interface TokenProvider {
  getToken(): Promise<string>;
}

/** Returns a fixed token. Primarily for tests and host-injected tokens. */
export class StaticTokenProvider implements TokenProvider {
  constructor(private readonly token: string) {
    if (!token?.trim()) {
      throw new LatticeError('AUTH_INVALID', 'StaticTokenProvider requires a non-empty token.');
    }
  }
  async getToken(): Promise<string> {
    return this.token;
  }
}

/**
 * Reads a pre-acquired bearer from an environment variable (default
 * `BRAIN_BEARER`). Used for easy-auth pass-through, mcp-auth, and
 * customer-override modes where the host supplies the token.
 */
export class EnvBearerTokenProvider implements TokenProvider {
  constructor(
    private readonly envVar: string = 'BRAIN_BEARER',
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) { }
  async getToken(): Promise<string> {
    const token = this.env[this.envVar];
    if (!token?.trim()) {
      throw new LatticeError(
        'AUTH_MISSING',
        `Expected a bearer token in environment variable ${this.envVar} for this auth mode.`,
      );
    }
    return token.trim();
  }
}

/**
 * Acquires a token via `@azure/identity` (`DefaultAzureCredential`), which
 * covers managed identity in containers and `az login` in dev. When
 * `SB_AUTH_DEVICE_CODE=1` and the default chain fails, falls back to the
 * interactive device-code flow (opt-in only, so containers never block).
 * `@azure/identity` is imported lazily so pass-through modes need not install it.
 */
export class AzureIdentityTokenProvider implements TokenProvider {
  constructor(
    private readonly scope: string,
    private readonly tenantId?: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
    // Injectable loader for `@azure/identity`. Defaults to a lazy import so
    // pass-through modes need not install the dependency; tests inject a fake
    // to avoid real credential acquisition and network access.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly loadIdentity: () => Promise<any> = () => import('@azure/identity'),
  ) { }

  async getToken(): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let identity: any;
    try {
      identity = await this.loadIdentity();
    } catch {
      throw new LatticeError(
        'AUTH_DEPENDENCY_MISSING',
        'entra-bearer mode requires @azure/identity. Run "npm ci" in tools/lattice-client.',
      );
    }
    const options = this.tenantId ? { tenantId: this.tenantId } : undefined;
    try {
      const credential = new identity.DefaultAzureCredential(options);
      const result = await credential.getToken(this.scope);
      if (result?.token) {
        return result.token;
      }
    } catch (err) {
      if (this.env.SB_AUTH_DEVICE_CODE !== '1') {
        throw new LatticeError(
          'AUTH_FAILED',
          'DefaultAzureCredential could not acquire a token. Run "az login", use a managed identity, or set SB_AUTH_DEVICE_CODE=1 to enable interactive sign-in.',
          undefined,
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (this.env.SB_AUTH_DEVICE_CODE === '1') {
      const credential = new identity.DeviceCodeCredential({
        tenantId: this.tenantId,
        userPromptCallback: (info: { message: string }) => {
          // eslint-disable-next-line no-console
          console.log(info.message);
        },
      });
      const result = await credential.getToken(this.scope);
      if (result?.token) {
        return result.token;
      }
    }
    throw new LatticeError('AUTH_FAILED', 'Unable to acquire an Entra token for Lattice.');
  }
}

/**
 * Build the appropriate {@link TokenProvider} for a config's auth mode.
 * - `entra-bearer` → DefaultAzureCredential (managed identity / az login).
 * - `easy-auth`, `mcp-auth`, `customer-override` → host-supplied env bearer.
 */
export function createTokenProvider(config: LatticeConfig, env: NodeJS.ProcessEnv = process.env): TokenProvider {
  if (env.BRAIN_BEARER?.trim()) {
    return new EnvBearerTokenProvider('BRAIN_BEARER', env);
  }

  switch (config.authMode) {
    case 'entra-bearer':
      return new AzureIdentityTokenProvider(resolveScope(config), config.tenantId, env);
    case 'easy-auth':
    case 'mcp-auth':
    case 'customer-override':
      return new EnvBearerTokenProvider('BRAIN_BEARER', env);
    default:
      throw new LatticeError('AUTH_INVALID', `Unsupported auth mode: ${String(config.authMode)}.`);
  }
}

export interface JwtSubject {
  oid?: string;
  sub?: string;
  tid?: string;
}

/**
 * Decode a JWT's payload for audit metadata only. The Lattice derives the
 * caller's real identity from the validated token — never from request bodies.
 * Returns an empty object for malformed tokens (never throws).
 */
export function decodeJwtSubject(token: string): JwtSubject {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {};
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    return {
      oid: typeof payload.oid === 'string' ? payload.oid : undefined,
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      tid: typeof payload.tid === 'string' ? payload.tid : undefined,
    };
  } catch {
    return {};
  }
}

/** Best-effort caller id for audit records: `oid` preferred, then `sub`. */
export function deriveUserId(token: string): string {
  const subject = decodeJwtSubject(token);
  return subject.oid ?? subject.sub ?? 'unknown';
}
