import { Disposable } from '@/gm/base/common/lifecycle';
import { ISessionMainService } from '@/gm/platform/session/electron-main/session';
import { IRequestService } from '@/gm/platform/request/common/requestService';

import { IFileService } from '@/gm/platform/files/common/files';
import { IRestoredSessionState, IStateService } from '@/gm/platform/state/common/state';

import {
  ISessionInfo,
  ISessionInfoRequestResponse,
  ISessionLoginCredentials,
  SessionError,
} from '@/gm/platform/session/common/session';
import { IErrorResponse } from '@/gm/platform/request/common/request';

import {
  ISessionLogoutRequestAttributes,
  ISessionLogoutRequestResponse,
} from '@/gm/platform/request/electron-main/request/session/sessionLogout';

import { IEnvironmentService } from '@/gm/platform/env/node/environmentService';
import { ISessionInfoRequestAttributes } from '@/gm/platform/request/electron-main/request/session/sessionInfo';
import { CriticalError } from '@/gm/base/common/errors';

const MOCK_SESSION_DATA: ISessionInfo = {
  clientId: 1,
  sessionId: 'bp4yrk3feps4qk7yb9n5937',
  profile: {
    name: 'user_name',
    email: 'user_email',
  },
};

export class SessionMainService extends Disposable implements ISessionMainService {
  private _configuration: ISessionInfo = MOCK_SESSION_DATA;

  constructor(
    @IRequestService private readonly requestService: IRequestService,
    @IFileService private readonly fileService: IFileService,
    @IStateService private readonly stateService: IStateService,
    @IEnvironmentService private readonly environmentService: IEnvironmentService
  ) {
    super();
  }

  public get configuration(): ISessionInfo {
    return this._configuration;
  }

  public set configuration(configuration) {
    this._configuration = configuration;
  }

  public async login(credentials: ISessionLoginCredentials): Promise<void> {
    const response = await this.requestService.call<
      ISessionLoginCredentials,
      ISessionInfoRequestResponse,
      ISessionInfoRequestResponse,
      IErrorResponse
    >('session.login', credentials);

    if (response.hasError) {
      throw new SessionError(`Error when login`);
    }

    const result = response.result as ISessionInfoRequestResponse;
    const { sessionId } = result.session;

    this.environmentService.sessionId = sessionId;
    this.configuration = result.session;

    this.stateService.setItem('sessionState', {
      sessionId,
    });
  }

  public async logout(): Promise<void> {
    const sessionId = this.environmentService.sessionId;

    const response = await this.requestService.call<
      ISessionLogoutRequestAttributes,
      ISessionLogoutRequestResponse,
      ISessionLogoutRequestResponse
    >('session.logout', {
      sessionId,
    });

    if (response.hasError) {
      throw new Error(`Error when logout`);
    }
  }

  public async restoreSession(): Promise<void> {
    const restoredSessionData = await this.stateService.getItem<IRestoredSessionState>(
      'sessionState'
    );

    if (!restoredSessionData?.sessionId) {
      throw new SessionError('Cant restore session');
    }

    const { sessionId } = restoredSessionData;
    this.environmentService.sessionId = sessionId;

    const response = await this.requestService.call<
      ISessionInfoRequestAttributes,
      ISessionInfoRequestResponse,
      ISessionInfoRequestResponse
    >('session.info', { sessionId });

    if (response.hasError) {
      throw new CriticalError('Error when fetching restored session');
    }

    const result = response.result as ISessionInfoRequestResponse;
    this.configuration = result.session;
  }
}
