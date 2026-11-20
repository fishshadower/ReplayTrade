import type { ToolDef } from './shared';
import { spec } from './shared';

/** 折线箭头：多点转折 + 末端实心箭头（TV 的 path arrow）。 */
export const PathArrowTool: ToolDef = {
  id: 'pathArrow',
  model: 'multipoint',
  build: (points, style) =>
    spec('pathArrow', points, style, { data: { arrowheadSize: 11 } }),
};
