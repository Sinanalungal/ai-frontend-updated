/**
 * Utility functions for drawing smooth curves using quadratic Bézier curves
 */

/**
 * Draw a smooth curve through a series of points using quadratic Bézier curves
 * @param ctx - Canvas 2D context
 * @param points - Array of [x, y] coordinate pairs
 * @param tension - Smoothness factor (0-1, higher = smoother)
 */
export function drawSmoothCurve(
  ctx: CanvasRenderingContext2D,
  points: number[][],
  tension: number = 0.3
): void {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const previous = points[i - 1];

    // Calculate control points for smooth curves
    const cp1x = current[0] + (next[0] - previous[0]) * tension;
    const cp1y = current[1] + (next[1] - previous[1]) * tension;
    const cp2x = next[0] - (next[0] - previous[0]) * tension;
    const cp2y = next[1] - (next[1] - previous[1]) * tension;

    ctx.quadraticCurveTo(cp1x, cp1y, next[0], next[1]);
  }

  // Handle the last point
  if (points.length > 2) {
    const last = points[points.length - 1];
    const secondLast = points[points.length - 2];
    const thirdLast = points[points.length - 3];

    const cp1x = secondLast[0] + (last[0] - thirdLast[0]) * tension;
    const cp1y = secondLast[1] + (last[1] - thirdLast[1]) * tension;

    ctx.quadraticCurveTo(cp1x, cp1y, last[0], last[1]);
  } else {
    ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
  }
}

/**
 * Draw a smooth closed curve (polygon) through a series of points
 * @param ctx - Canvas 2D context
 * @param points - Array of [x, y] coordinate pairs
 * @param tension - Smoothness factor (0-1, higher = smoother)
 */
export function drawSmoothClosedCurve(
  ctx: CanvasRenderingContext2D,
  points: number[][],
  tension: number = 0.3
): void {
  if (points.length < 3) return;

  // Add the first point to the end to close the curve
  const closedPoints = [...points, points[0]];
  drawSmoothCurve(ctx, closedPoints, tension);
  ctx.closePath();
}

/**
 * Draw a smooth polygon with optional fill and stroke
 * @param ctx - Canvas 2D context
 * @param points - Array of [x, y] coordinate pairs
 * @param closed - Whether to close the polygon
 * @param tension - Smoothness factor (0-1, higher = smoother)
 * @param fill - Whether to fill the polygon
 * @param stroke - Whether to stroke the polygon
 */
export function drawSmoothPolygon(
  ctx: CanvasRenderingContext2D,
  points: number[][],
  closed: boolean = true,
  tension: number = 0.3,
  fill: boolean = true,
  stroke: boolean = true
): void {
  if (points.length < 2) return;

  ctx.beginPath();

  if (closed && points.length >= 3) {
    drawSmoothClosedCurve(ctx, points, tension);
  } else {
    drawSmoothCurve(ctx, points, tension);
  }

  if (fill) {
    ctx.fill();
  }

  if (stroke) {
    ctx.stroke();
  }
}

/**
 * Create smooth control points for a polygon
 * @param points - Array of [x, y] coordinate pairs
 * @param tension - Smoothness factor (0-1, higher = smoother)
 * @returns Array of control points
 */
export function createSmoothControlPoints(
  points: number[][],
  tension: number = 0.3
): number[][][] {
  if (points.length < 3) return [];

  const controlPoints: number[][][] = [];

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const previous = points[(i - 1 + points.length) % points.length];

    const cp1x = current[0] + (next[0] - previous[0]) * tension;
    const cp1y = current[1] + (next[1] - previous[1]) * tension;
    const cp2x = next[0] - (next[0] - previous[0]) * tension;
    const cp2y = next[1] - (next[1] - previous[1]) * tension;

    controlPoints.push([
      [cp1x, cp1y],
      [cp2x, cp2y]
    ]);
  }

  return controlPoints;
}

/**
 * Draw a smooth polygon with enhanced visual appeal
 * @param ctx - Canvas 2D context
 * @param points - Array of [x, y] coordinate pairs
 * @param options - Drawing options
 */
export function drawEnhancedSmoothPolygon(
  ctx: CanvasRenderingContext2D,
  points: number[][],
  options: {
    closed?: boolean;
    tension?: number;
    fill?: boolean;
    stroke?: boolean;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    shadowBlur?: number;
    shadowColor?: string;
  } = {}
): void {
  const {
    closed = true,
    tension = 0.3,
    fill = true,
    stroke = true,
    fillColor = "rgba(255, 0, 0, 0.5)",
    strokeColor = "rgba(255, 0, 0, 0.8)",
    strokeWidth = 2,
    shadowBlur = 0,
    shadowColor = "rgba(0, 0, 0, 0.3)"
  } = options;

  if (points.length < 2) return;

  // Save context state
  ctx.save();

  // Set shadow
  if (shadowBlur > 0) {
    ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = shadowColor;
  }

  // Set fill and stroke styles
  if (fill) {
    ctx.fillStyle = fillColor;
  }
  if (stroke) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  // Draw the smooth polygon
  drawSmoothPolygon(ctx, points, closed, tension, fill, stroke);

  // Restore context state
  ctx.restore();
}
