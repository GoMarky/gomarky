import { IRequestRegister } from '@/gm/platform/request/common/requestService';
import {
  ECHO_REQUEST_ID,
  EchoRequest,
} from '@/gm/platform/request/electron-main/request/common/echoRequest';

import {
  SESSION_LOGIN_REQUEST_ID,
  SessionLogin,
} from '@/gm/platform/request/electron-main/request/session/sessionLogin';

import {
  SESSION_LOGOUT_REQUEST_ID,
  SessionLogout,
} from '@/gm/platform/request/electron-main/request/session/sessionLogout';

import {
  SESSION_INFO_REQUEST_ID,
  SessionInfo,
} from '@/gm/platform/request/electron-main/request/session/sessionInfo';

const requests: IRequestRegister[] = [];

requests.push({
  id: ECHO_REQUEST_ID,
  ctor: EchoRequest,
});

requests.push({
  id: SESSION_LOGIN_REQUEST_ID,
  ctor: SessionLogin,
});

requests.push({
  id: SESSION_LOGOUT_REQUEST_ID,
  ctor: SessionLogout,
});

requests.push({
  id: SESSION_INFO_REQUEST_ID,
  ctor: SessionInfo,
});

export default requests;
