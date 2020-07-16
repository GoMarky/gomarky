/**
 * @author Teodor_Dre <swen295@gmail.com>
 *
 * @description
 *  Select or unselect geometry. Depends on current select bounds.
 *
 * @param {Layer} layer
 * @param {PIXI.Rectangle} selectBounds - bounds of range select.
 *
 * @returns void
 */
import { Layer } from '@/core';

export const handleSelectBounds = (layer: Layer, selectBounds: PIXI.Rectangle) => {
  const { left: x1, top: y1, right: x2, bottom: y2 } = selectBounds;

  const {
    left: x3,
    top: y3,
    right: x4,
    bottom: y4,
  } = layer.container.geometry.container.getBounds();

  if (
    (x3 > x1 && x3 < x2 && ((y3 > y1 && y3 < y2) || (y4 > y1 && y4 < y2))) ||
    (x4 > x1 && x4 < x2 && ((y3 > y1 && y3 < y2) || (y4 > y1 && y4 < y2)))
  ) {
    layer.selected = true;
  } else {
    if (layer.selected) {
      layer.selected = false;
    }
  }
};
