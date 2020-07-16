import * as osai from 'osai';

import React, { FC } from 'react';
import ReactDOM from 'react-dom';

import { IconZoomIn } from './icons/IconZoomIn';
import { IconZoomOut } from './icons/IconZoomOut';
import { IconFullScreen } from './icons/IconFullScreen';

const Root: FC = () => <App />;

class App extends React.Component {
  constructor(props: Readonly<{}>) {
    super(props);
  }

  public render() {
    return (
      <div className="t-toolbar__block-bottom">
        <div className="t-round-element">
          <button
            onClick={osai.scene.zoomIn}
            className="t-round-element__button-zoom"
            type="button"
          >
            <IconZoomIn width={24} height={24} />
          </button>
          {/*<div className="tRegular10">100%</div>*/}
          <button
            onClick={osai.scene.zoomOut}
            className="t-round-element__button-zoom"
            type="button"
          >
            <IconZoomOut width={24} height={24} />
          </button>
        </div>
        <div className="t-round-element _fullscreen">
          <button
            onClick={osai.window.maximize}
            className="t-round-element__button-screen"
            type="button"
          >
            <IconFullScreen width={24} height={24} />
          </button>
        </div>
      </div>
    );
  }
}

export function createView(): HTMLElement {
  const appEl = document.createElement('div');

  ReactDOM.render(<Root />, appEl);

  return appEl;
}
