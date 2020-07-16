import { createDecorator } from '@/gm/platform/instantiation/common/instantiation';

const SESSION_ERROR_NAME = 'SessionError';

export class SessionError extends Error {
  public readonly name = SESSION_ERROR_NAME;
}

export interface ISessionInfo {
  clientId: number;
  sessionId: string;
  profile: {
    name: string;
    email: string;
  };
}

export interface ISessionInfoRequestResponse {
  result: string;
  session: ISessionInfo;
}

export interface ISessionLoginCredentials {
  email: string;
  password: string;
}

export const ISessionService = createDecorator<ISessionService>('sessionService');

export interface ISessionService {
  login(credentials: ISessionLoginCredentials): Promise<void>;

  logout(): Promise<void>;
}
