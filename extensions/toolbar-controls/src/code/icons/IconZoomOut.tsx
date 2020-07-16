import React, { FC } from 'react';
import { IIconProps } from '../types/icons';

export const IconZoomOut: FC<IIconProps> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    className="icon"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path fill="currentColor" d="M8 11.5h8v1H8z" fillRule="evenodd" />
  </svg>
);
