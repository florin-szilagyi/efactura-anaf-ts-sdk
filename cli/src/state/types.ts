export type Environment = 'test' | 'prod';

export interface Credential {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

export interface Company {
  cui: string;
  name: string;
  registrationNumber?: string;
  address?: string;
}

export interface CliConfig {
  activeCui?: string;
  env?: Environment;
}

export interface CliConfigDefaults {
  output?: 'stdout' | 'file';
  format?: 'text' | 'json';
}

export interface TokenRecord {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: string;
  obtainedAt?: string;
}
