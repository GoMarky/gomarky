export function onUnexpectedError(error: any) {
  console.log('Unexpected error%', error);
}

const canceledName = 'Canceled';

export function canceled(): Error {
  const error = new Error(canceledName);
  error.name = error.message;

  return error;
}

const CRITICAL_ERROR_NAME = 'CriticalError';

export class CriticalError extends Error {
  public readonly name = CRITICAL_ERROR_NAME;
}
