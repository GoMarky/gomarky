import { Layer } from '@/gl/gomarky/core/geometry/layer/layer';

import {
  ControlPoint,
  Ellipse,
  GlCoreError,
  IApplication,
  ICreateGeometryOptions,
  Polygon,
  Rectangle,
  ShapeType,
} from '@/gl/gomarky';
import { Container } from '@/gl/gomarky/core/geometry/container/container';
import { Geometry } from '@/gl/gomarky/core/geometry/geometry/geometry';

function createShape(
  type: ShapeType,
  app: IApplication,
  { startEvent }: ICreateGeometryOptions
): Geometry {
  let geometry: Geometry;

  switch (type) {
    case ShapeType.Rectangle:
      geometry = new Rectangle(app, { startEvent });
      break;
    case ShapeType.Polygon:
      geometry = new Polygon(app, { startEvent });
      break;
    case ShapeType.Ellipse:
      geometry = new Ellipse(app, { startEvent });
      break;
    default:
      throw new GlCoreError(`Incorrect geometry provided - ${type}`);
  }

  return geometry;
}

export class Shape extends Layer {
  constructor(
    name = 'Shape',
    private readonly type: ShapeType,
    app: IApplication,
    startEvent?: PIXI.interaction.InteractionEvent
  ) {
    super(name, app);

    const geometry = createShape(type, app, { startEvent });

    this.container = new Container(app, { geometry }, this);
  }

  public duplicate(): Shape {
    const {
      name,
      type,
      app,
      container: {
        geometry: { points },
      },
    } = this;

    const shape = new Shape(name, type, app);
    shape.name = name;

    app.scene.root.appendChild(shape);

    shape.container.geometry.points = points.map(
      point =>
        new ControlPoint(app, shape.container, { x: point.x, y: point.y, show: true, radius: 5 })
    );

    shape.container.geometry.stop();

    return shape;
  }
}
