import React, { FC } from 'react';
import { IIconProps } from '../types/icons';

export const IconFullScreen: FC<IIconProps> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    className="icon"
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g fill="none" fillRule="evenodd">
      <path d="M4 4h24v24H4z" />
      <path
        fill="currentColor"
        fillRule="nonzero"
        d="M10 18H9v5h5v-1h-4v-4zm-1-4h1v-4h4V9H9v5zm13 8h-4v1h5v-5h-1v4zM18 9v1h4v4h1V9h-5z"
      />
    </g>
  </svg>
);
