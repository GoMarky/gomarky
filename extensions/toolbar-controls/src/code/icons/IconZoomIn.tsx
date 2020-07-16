import React, { FC } from 'react';
import { IIconProps } from '../types/icons';

export const IconZoomIn: FC<IIconProps> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    className="icon"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="currentColor"
      d="M12.5 11.5H16v1h-3.5V16h-1v-3.5H8v-1h3.5V8h1v3.5z"
      fillRule="evenodd"
    />
  </svg>
);
