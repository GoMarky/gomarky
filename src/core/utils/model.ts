export enum Stage {
  Unselected = 'Unselected',
  Hover = 'Hover',
  Selected = 'Selected',
  Drawning = 'Drawning',
  Dragging = 'Dragging',
}

export enum ShapeType {
  Polygon = 'Polygon',
  Rectangle = 'Rectangle',
  Ellipse = 'Ellipse',
}

export enum MaskType {
  Union = 'Union',
  Subtract = 'Subtract',
  Intersect = 'Intersect',
  Difference = 'Difference',
}

export enum Point {
  Control = 'Control',
  Shadow = 'Shadow',
}

export enum FigureAction {
  Remove = 'Remove',
  Hover = 'Hover',
  HoverOut = 'HoverOut',
  Show = 'Show',
  Hide = 'Hide',
  Select = 'Select',
}
