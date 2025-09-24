/**
 * Utility functions for drawing smooth curves using advanced curve smoothing algorithms
 */

/**
 * Subdivide a curve to create more control points for smoother rendering
 * @param points - Array of [x, y] coordinate pairs
 * @param subdivisions - Number of subdivisions per segment
 * @returns Array of subdivided points
 */
function subdivideCurve(points: number[][], subdivisions: number = 2): number[][] {
  if (points.length < 2) return points;
  
  const subdivided: number[][] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    subdivided.push(current);
    
    // Add intermediate points for smoother curves
    for (let j = 1; j < subdivisions; j++) {
      const t = j / subdivisions;
      const x = current[0] + (next[0] - current[0]) * t;
      const y = current[1] + (next[1] - current[1]) * t;
      subdivided.push([x, y]);
    }
  }
  
  subdivided.push(points[points.length - 1]);
  return subdivided;
}

/**
 * Draw a smooth curve through a series of points using advanced curve smoothing
 * @param ctx - Canvas 2D context
 * @param points - Array of [x, y] coordinate pairs
 * @param tension - Smoothness factor (0-1, higher = smoother)
 */
export function drawSmoothCurve(
  ctx: CanvasRenderingContext2D,
  points: number[][],
  tension: number = 0.8
): void {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  if (points.length === 2) {
    ctx.lineTo(points[1][0], points[1][1]);
    return;
  }

  // Subdivide the curve for smoother rendering
  const subdividedPoints = subdivideCurve(points, 3);
  
  // Use Catmull-Rom spline for truly smooth curves
  for (let i = 0; i < subdividedPoints.length - 1; i++) {
    const p0 = subdividedPoints[Math.max(0, i - 1)];
    const p1 = subdividedPoints[i];
    const p2 = subdividedPoints[i + 1];
    const p3 = subdividedPoints[Math.min(subdividedPoints.length - 1, i + 2)];

    // Calculate Catmull-Rom control points with higher tension for smoother curves
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension * 0.5;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension * 0.5;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension * 0.5;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension * 0.5;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
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
  tension: number = 0.8
): void {
  if (points.length < 3) return;

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  // Subdivide the curve for smoother rendering
  const subdividedPoints = subdivideCurve(points, 3);
  
  // Use Catmull-Rom spline for truly smooth closed curves
  for (let i = 0; i < subdividedPoints.length; i++) {
    const p0 = subdividedPoints[(i - 1 + subdividedPoints.length) % subdividedPoints.length];
    const p1 = subdividedPoints[i];
    const p2 = subdividedPoints[(i + 1) % subdividedPoints.length];
    const p3 = subdividedPoints[(i + 2) % subdividedPoints.length];

    // Calculate Catmull-Rom control points for smooth curves with higher tension
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension * 0.5;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension * 0.5;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension * 0.5;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension * 0.5;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
  }

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
  tension: number = 0.8,
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
  tension: number = 0.8
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
    tension = 0.6,
    fill = true,
    stroke = true,
    fillColor = "rgba(255, 0, 0, 0.5)",
    strokeColor = "rgba(255, 0, 0, 0.8)",
    strokeWidth = 1.5,
    shadowBlur = 0,
    shadowColor = "rgba(0, 0, 0, 0.2)"
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
                ctx.lineDashOffset = 0;
                ctx.setLineDash([]); // Ensure no dash pattern
                ctx.miterLimit = 10; // Smooth joins
            }

  // Draw the smooth polygon
  drawSmoothPolygon(ctx, points, closed, tension, fill, stroke);

  // Restore context state
  ctx.restore();
}
