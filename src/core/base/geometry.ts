import * as PIXI from 'pixi.js';
import { Color, ISerializedRGBA } from '@/gm/base/color';
import { ShapeType, Point } from '@/gl/gomarky/utils/model';

import { Position } from '@/gm/base/geojson';
import { ControlPoint } from '@/gl/gomarky/core/geometry/geometry/points/controlpoint';

export type GeometryMoveDirection = 'left' | 'right' | 'up' | 'down';

//#region COMMON GEOMETRY

export interface IColorBasedProperties {
  fillColor: Color;
  fillColorHover: Color;
  lineColor: Color;
  lineColorHover: Color;
}

export interface IShapeDrawOptions {
  lineColor: Color;
  fillColor: Color;
  lineWidth: number;
}

export interface ICreateGeometryOptions {
  startEvent?: PIXI.interaction.InteractionEvent;
}

export interface ISerializedGeometry {
  color: ISerializedRGBA;
  type: ShapeType;
  id: string; // xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  points: Position[];
}

//#endregion

//#region ELLIPSE

export interface ISerializedEllipse extends ISerializedGeometry {
  points: Position[];
}

//#endregion

//#region Polygon

export interface ISerializedPolygon extends ISerializedGeometry {
  points: Position[]; // Array of [x, y]
}

//#endregion

//#region RECTANGLE

export interface ISerializedRectangle extends ISerializedGeometry {
  points: Position[];
}

//#endregion

//#region POINT

export type PointLike = ControlPoint;

export interface IPointCreateOptions {
  radius: number;
  x: number;
  y: number;
  show: boolean;
  name?: Point;
}

export interface IPointDrawOptions extends IShapeDrawOptions {
  radius: number;
}

export type ShadowPointEdges = number[][];

export interface IShadowPointCreateOptions extends IPointCreateOptions {
  edges: ShadowPointEdges;
}

//#endregion
