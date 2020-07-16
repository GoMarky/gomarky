export interface IMultiClickHandler<T> {
  [n: number]: (arg: T) => void;
}

export const multiClickHandler = <T>(
  handlers: IMultiClickHandler<T>,
  delay = 250,
  thisArg?: any
) => {
  let clicks = 0;
  let timeout: number;

  return (event: T) => {
    clicks++;
    window.clearTimeout(timeout);

    timeout = window.setTimeout(() => {
      const handler = handlers[clicks];

      if (handler) {
        handler.call(thisArg, event);
      }
      clicks = 0;
    }, delay);
  };
};
