import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  // Maximize2,
  // Layers,
  // Settings,
  // Search,
  Ruler,
  Move,
  Download,
  // FileText,
  Moon,
  Sun,
  MousePointer,
  Undo,
  SquarePen,
  Square,
  Minus,
  Dot,
  ImageMinus,
  Highlighter,
  Play,
  // Logs,
} from "lucide-react";
import { BsBoundingBoxCircles } from "react-icons/bs";
import { MdOutlineCloudUpload } from "react-icons/md";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "sonner";
import { classColors } from "@/constants/teethRelated";
import { ToolButton } from "./ToolButton";
import RenderOPGAnnotationsList from "./RenderOpgAnnotationsList";
import RenderCustomAnnotationsList from "./RenderCustomAnnotationsList";
import { useNavigate } from "react-router-dom";
import { TbSwitch3 } from "react-icons/tb";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { checkTypeOptions } from "@/constants/teethRelated";
import { drawSmoothPolygon, drawEnhancedSmoothPolygon } from "@/utility/smoothCurves";


interface Drawing {
  type: string;
  points: number[];
  label: string;
  id: string;
  visible: boolean;
  transform?: any;
  toothNumber?: string;
  pathology?: string;
  customPathology?: string;
  strokeColor?: string;
  bgColor?: string;
  showStroke?: boolean;
  showBackground?: boolean;
  OpenDrawer: boolean;
  showLabel: boolean;
}

interface Annotation {
  class: string;
  roi_xyxy: Array<{
    coordinates: number[];
    poly?: number[][];
    visible: boolean;
    id: string;
    label: string;
    strokeColor?: string;
    bgColor?: string;
    showStroke?: boolean;
    openDrawer: boolean;
    showBackground?: boolean;
    showLabel: boolean;
  }>;
}

interface UploadResponse {
  message: string;
  data: {
    inference_time: number;
    results: Array<{
      class: string;
      roi_xyxy: number[][];
      poly?: number[][][];
    }>;
    unique_id: string;
  };
}

const SNAP_THRESHOLD = 10;

export default function Viewer() {
  const [theme, setTheme] = useState("dark");
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [checkType, setCheckType] = useState<"qc" | "path" | "tooth">("qc");
  const [isAnnotationEnabled, setIsAnnotationEnabled] = useState(true);
  const [_uploadResponse, setUploadResponse] = useState<UploadResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<string>("select");
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [isPolygonDrawing, setIsPolygonDrawing] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [transformOrigin, setTransformOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null
  );
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    null
  );
  const [draggedPointOffset, setDraggedPointOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [drawingHistory, setDrawingHistory] = useState<Drawing[][]>([]);
  const [showSelecting, setShowSelecting] = useState(false);
  const [_selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const getScaledPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setUploadResponse(null);
    setAnnotations([]);
    setDrawings([]);
    setDrawingHistory([]);
    setIsDrawing(false);
    setIsPolygonDrawing(false);
    setCurrentPoints([]);
    setImageSize({ width: 0, height: 0 });

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleUndo = () => {
    if (drawingHistory.length > 0) {
      const previousState = drawingHistory[drawingHistory.length - 1];
      setDrawings(previousState);
      setDrawingHistory((history) => history.slice(0, -1));
      if (showSelecting) {
        setShowSelecting(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setInfoPanelOpen(false);
    setIsLoading(true);
    setAnnotations([]);
    setUploadResponse(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("model_name", checkType);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/inference/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "ngrok-skip-browser-warning": "1",
          },
        }
      );

      const responseData = res.data as UploadResponse;
      setUploadResponse(responseData);
      processApiResponse(responseData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to process image");
    } finally {
      setIsLoading(false);
    }
  };

  const findNearestPoint = (x: number, y: number) => {
    const threshold = 10;

    for (const drawing of drawings) {
      if (!drawing.visible) continue;

      switch (drawing.type) {
        case "rectangle": {
          const points = [
            [drawing.points[0], drawing.points[1]],
            [drawing.points[2], drawing.points[1]],
            [drawing.points[2], drawing.points[3]],
            [drawing.points[0], drawing.points[3]],
          ];

          for (let i = 0; i < points.length; i++) {
            const dx = points[i][0] - x;
            const dy = points[i][1] - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < threshold) {
              return {
                drawingId: drawing.id,
                pointIndex: i,
                originalX: points[i][0],
                originalY: points[i][1],
              };
            }
          }
          break;
        }
        case "line": {
          const points = [
            [drawing.points[0], drawing.points[1]],
            [drawing.points[2], drawing.points[3]],
          ];

          for (let i = 0; i < points.length; i++) {
            const dx = points[i][0] - x;
            const dy = points[i][1] - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < threshold) {
              return {
                drawingId: drawing.id,
                pointIndex: i,
                originalX: points[i][0],
                originalY: points[i][1],
              };
            }
          }
          break;
        }
        case "polygon": {
          for (let i = 0; i < drawing.points.length; i += 2) {
            const dx = drawing.points[i] - x;
            const dy = drawing.points[i + 1] - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < threshold) {
              return {
                drawingId: drawing.id,
                pointIndex: i / 2,
                originalX: drawing.points[i],
                originalY: drawing.points[i + 1],
              };
            }
          }
          break;
        }
      }
    }
    return null;
  };

  const isPointInPolygon = (
    x: number,
    y: number,
    points: any[] | number[][]
  ) => {
    let vertices: number[][] = [];
    if (Array.isArray(points[0])) {
      vertices = points as number[][];
    } else {
      vertices = [];
      for (let i = 0; i < points.length; i += 2) {
        vertices.push([points[i], points[i + 1]]);
      }
    }

    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i][0];
      const yi = vertices[i][1];
      const xj = vertices[j][0];
      const yj = vertices[j][1];

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  };

  const findShapeAtPoint = (
    x: number,
    y: number,
    scaleX: number,
    scaleY: number
  ) => {
    for (const annotation of annotations) {
      for (const coord of annotation.roi_xyxy) {
        if (!coord.visible) continue;

        if ((checkType === "path" || checkType === "tooth") && coord.poly && coord.poly.length > 0) {
          const scaledPoly = coord.poly.map(([px, py]) => [
            px * scaleX,
            py * scaleY,
          ]);
          if (isPointInPolygon(x, y, scaledPoly)) {
            return {
              type: "annotation",
              className: annotation.class,
              coordId: coord.id,
            };
          }
        } else {
          const [x1, y1, x2, y2] = coord.coordinates;
          const scaledX1 = x1 * scaleX;
          const scaledY1 = y1 * scaleY;
          const scaledX2 = x2 * scaleX;
          const scaledY2 = y2 * scaleY;

          if (
            x >= scaledX1 &&
            x <= scaledX2 &&
            y >= scaledY1 &&
            y <= scaledY2
          ) {
            return {
              type: "annotation",
              className: annotation.class,
              coordId: coord.id,
            };
          }
        }
      }
    }

    for (const drawing of drawings) {
      if (!drawing.visible) continue;

      switch (drawing.type) {
        case "rectangle": {
          const [x1, y1, x2, y2] = drawing.points;
          if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
            return {
              type: "drawing",
              drawingId: drawing.id,
            };
          }
          break;
        }
        case "line": {
          const [x1, y1, x2, y2] = drawing.points;
          const distance = pointToLineDistance(x, y, x1, y1, x2, y2);
          if (distance < 10) {
            return {
              type: "drawing",
              drawingId: drawing.id,
            };
          }
          break;
        }
        case "polygon": {
          if (isPointInPolygon(x, y, drawing.points)) {
            return {
              type: "drawing",
              drawingId: drawing.id,
            };
          }
          break;
        }
        case "point": {
          const [px, py] = drawing.points;
          const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
          if (distance < 10) {
            return {
              type: "drawing",
              drawingId: drawing.id,
            };
          }
          break;
        }
      }
    }
    return null;
  };

  const pointToLineDistance = (
    x: number,
    y: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    const param = len_sq !== 0 ? dot / len_sq : -1;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleShapeClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getScaledPoint(e);
    if (!point) return;

    const { x, y } = point;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageElement = containerRef.current?.querySelector("img");
    if (!imageElement) return;

    const displayedWidth = imageElement.clientWidth;
    const displayedHeight = imageElement.clientHeight;

    const scaleX = displayedWidth / imageSize.width;
    const scaleY = displayedHeight / imageSize.height;

    const shape = findShapeAtPoint(x, y, scaleX, scaleY);

    if (shape) {
      if (shape.type === "annotation") {
        setAnnotations((prev) =>
          prev.map((annotation) => {
            if (annotation.class !== shape.className) return annotation;
            return {
              ...annotation,
              roi_xyxy: annotation.roi_xyxy.map((coord) => {
                if (coord.id !== shape.coordId) return coord;
                return { ...coord, showLabel: !coord.showLabel };
              }),
            };
          })
        );
      } else if (shape.type === "drawing") {
        setDrawings((prev) =>
          prev.map((drawing) => {
            if (drawing.id !== shape.drawingId) return drawing;
            return { ...drawing, showLabel: !drawing.showLabel };
          })
        );
      }
      drawAnnotations();
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotationEnabled || (currentTool === "select" && !isTransforming)) {
      handleShapeClick(e);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imageElement = containerRef.current?.querySelector("img");
    if (!imageElement) return;

    const displayedWidth = imageElement.clientWidth;
    const displayedHeight = imageElement.clientHeight;

    const scaleX = imageSize.width / displayedWidth;
    const scaleY = imageSize.height / displayedHeight;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    if (currentTool === "move") {
      const shape:any = findShapeAtPoint(scaledX, scaledY, 1, 1);
      if (shape?.type === "drawing") {
        setIsTransforming(true);
        setSelectedShape(shape.drawingId);
        setTransformOrigin({ x: scaledX, y: scaledY });
        return;
      }
    }

    if (isDrawing || (isPolygonDrawing && currentTool !== "polygon")) {
      setIsDrawing(false);
      setIsPolygonDrawing(false);
      setCurrentPoints([]);
      setStartPoint(null);
      drawAnnotations();
      return;
    }

    if (currentTool === "reshape") {
      const nearestPoint = findNearestPoint(scaledX, scaledY);
      if (nearestPoint) {
        setSelectedDrawingId(nearestPoint.drawingId);
        setSelectedPointIndex(nearestPoint.pointIndex);
        setIsDraggingPoint(true);
        setDraggedPointOffset({
          x: scaledX - nearestPoint.originalX,
          y: scaledY - nearestPoint.originalY,
        });
        return;
      }
    } else if (currentTool === "polygon") {
      if (!isPolygonDrawing) {
        setIsPolygonDrawing(true);
        setCurrentPoints([scaledX, scaledY]);
      } else {
        const startX = currentPoints[0];
        const startY = currentPoints[1];
        const distance = Math.sqrt(
          Math.pow(scaledX - startX, 2) + Math.pow(scaledY - startY, 2)
        );

        if (distance < SNAP_THRESHOLD && currentPoints.length >= 6) {
          setDrawingHistory((history) => [...history, [...drawings]]);
          const newDrawing: Drawing = {
            type: "polygon",
            points: [...currentPoints],
            label: ``,
            id: `drawing-${Date.now()}`,
            visible: true,
            transform: { scale: 1, rotation: 0, translate: { x: 0, y: 0 } },
            strokeColor: "#FFFFFF",
            bgColor: "rgba(255, 255, 255, 0.3)",
            showStroke: true,
            showBackground: true,
            OpenDrawer: false,
            showLabel: false,
          };
          setDrawings([...drawings, newDrawing]);
          setIsPolygonDrawing(false);
          setCurrentPoints([]);
          setShowSelecting(true);
        } else {
          setCurrentPoints((prev) => [...prev, scaledX, scaledY]);
        }
      }
    } else if (currentTool === "point") {
      setDrawingHistory((history) => [...history, [...drawings]]);
      const newDrawing: Drawing = {
        type: "point",
        points: [scaledX, scaledY],
        label: ``,
        id: `drawing-${Date.now()}`,
        visible: true,
        transform: { scale: 1, rotation: 0, translate: { x: 0, y: 0 } },
        strokeColor: "#FFFFFF",
        bgColor: "rgba(255, 255, 255, 0.3)",
        showStroke: true,
        OpenDrawer: false,
        showBackground: true,
        showLabel: false,
      };
      setDrawings([...drawings, newDrawing]);
      setShowSelecting(true);
    } else {
      setIsDrawing(true);
      setStartPoint({ x: scaledX, y: scaledY });
    }
  };

  const drawShape = (ctx: CanvasRenderingContext2D, drawing: Drawing) => {
    if (!drawing.visible) return;

    ctx.beginPath();
    ctx.strokeStyle =
      drawing.showStroke && drawing.strokeColor
        ? drawing.strokeColor
        : "transparent";
    ctx.fillStyle =
      drawing.showBackground && drawing.bgColor
        ? drawing.bgColor
        : "transparent";
    ctx.lineWidth = 1;

    const points = drawing.points;
    switch (drawing.type) {
      case "rectangle":
        if (drawing.showBackground) {
          ctx.fillRect(
            points[0],
            points[1],
            points[2] - points[0],
            points[3] - points[1]
          );
        }
        if (drawing.showStroke) {
          ctx.strokeRect(
            points[0],
            points[1],
            points[2] - points[0],
            points[3] - points[1]
          );
        }
        break;
      case "line":
        ctx.moveTo(points[0], points[1]);
        ctx.lineTo(points[2], points[3]);
        if (drawing.showStroke) ctx.stroke();
        break;
      case "point":
        ctx.arc(points[0], points[1], 3, 0, Math.PI * 2);
        if (drawing.showBackground) ctx.fill();
        if (drawing.showStroke) ctx.stroke();
        break;
      case "polygon":
        if (points.length >= 6) {
          // Convert points to [x, y] format for smooth polygon
          const polygonPoints = [];
          for (let i = 0; i < points.length; i += 2) {
            polygonPoints.push([points[i], points[i + 1]]);
          }
          
          // Use smooth polygon drawing
          drawEnhancedSmoothPolygon(ctx, polygonPoints, {
            closed: true,
            tension: 0.3,
            fill: drawing.showBackground,
            stroke: drawing.showStroke,
            fillColor: drawing.bgColor || "rgba(255, 255, 255, 0.3)",
            strokeColor: drawing.strokeColor || "#FFFFFF",
            strokeWidth: 2,
            shadowBlur: 2,
            shadowColor: "rgba(0, 0, 0, 0.3)"
          });
        } else {
          // Fallback to regular polygon for very few points
          ctx.moveTo(points[0], points[1]);
          for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(points[i], points[i + 1]);
          }
          ctx.closePath();
          if (drawing.showBackground) ctx.fill();
          if (drawing.showStroke) ctx.stroke();
        }
        break;
    }

    if (drawing.label && drawing.showLabel) {
      ctx.font = "12px Poppins";
      const textMetrics = ctx.measureText(drawing.label);
      ctx.fillStyle =
        theme === "dark" ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(points[0], points[1] - 20, textMetrics.width + 10, 20);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(drawing.label, points[0] + 5, points[1] - 5);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotationEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageElement = containerRef.current?.querySelector("img");
    if (!imageElement) return;

    const displayedWidth = imageElement.clientWidth;
    const displayedHeight = imageElement.clientHeight;

    const scaleX = imageSize.width / displayedWidth;
    const scaleY = imageSize.height / displayedHeight;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    if (isTransforming && selectedShape && currentTool === "move") {
      const drawing = drawings.find((d) => d.id === selectedShape);
      if (!drawing || !transformOrigin) return;

      const dx = scaledX - transformOrigin.x;
      const dy = scaledY - transformOrigin.y;

      setDrawings(
        drawings.map((d) => {
          if (d.id === selectedShape) {
            return {
              ...d,
              points: d.points.map((point, index) =>
                index % 2 === 0 ? point + dx : point + dy
              ),
              transform: {
                ...d.transform,
                translate: {
                  x: (d.transform?.translate?.x || 0) + dx,
                  y: (d.transform?.translate?.y || 0) + dy,
                },
              },
            };
          }
          return d;
        })
      );

      setTransformOrigin({ x: scaledX, y: scaledY });
      drawAnnotations();
      return;
    }

    const point = getScaledPoint(e);
    if (!point) return;

    if (
      isDraggingPoint &&
      selectedDrawingId !== null &&
      selectedPointIndex !== null
    ) {
      const offsetX = draggedPointOffset
        ? point.x - draggedPointOffset.x
        : point.x;
      const offsetY = draggedPointOffset
        ? point.y - draggedPointOffset.y
        : point.y;

      setDrawings((prev) =>
        prev.map((drawing) => {
          if (drawing.id !== selectedDrawingId) return drawing;

          const newPoints = [...drawing.points];
          switch (drawing.type) {
            case "rectangle": {
              if (selectedPointIndex === 0) {
                newPoints[0] = offsetX;
                newPoints[1] = offsetY;
              } else if (selectedPointIndex === 1) {
                newPoints[2] = offsetX;
                newPoints[1] = offsetY;
              } else if (selectedPointIndex === 2) {
                newPoints[2] = offsetX;
                newPoints[3] = offsetY;
              } else if (selectedPointIndex === 3) {
                newPoints[0] = offsetX;
                newPoints[3] = offsetY;
              }
              break;
            }
            case "line": {
              const pointIndex = selectedPointIndex * 2;
              newPoints[pointIndex] = offsetX;
              newPoints[pointIndex + 1] = offsetY;
              break;
            }
            case "polygon": {
              newPoints[selectedPointIndex * 2] = offsetX;
              newPoints[selectedPointIndex * 2 + 1] = offsetY;
              break;
            }
          }
          return { ...drawing, points: newPoints };
        })
      );

      drawAnnotations();
      return;
    }

    if (isDrawing || isPolygonDrawing) {
      drawAnnotations();

      if (currentTool === "polygon" && isPolygonDrawing) {
        // Convert current points to [x, y] format
        const polygonPoints = [];
        for (let i = 0; i < currentPoints.length; i += 2) {
          polygonPoints.push([currentPoints[i], currentPoints[i + 1]]);
        }
        polygonPoints.push([x, y]);

        const startX = currentPoints[0];
        const startY = currentPoints[1];
        const distance = Math.sqrt(
          Math.pow(x - startX, 2) + Math.pow(y - startY, 2)
        );
        
        if (distance < SNAP_THRESHOLD && currentPoints.length >= 6) {
          // Close the polygon with smooth curves
          polygonPoints.push([startX, startY]);
          drawSmoothPolygon(ctx, polygonPoints, true, 0.3, false, true);
        } else {
          // Draw open polygon with smooth curves
          drawSmoothPolygon(ctx, polygonPoints, false, 0.3, false, true);
        }
      } else if (startPoint) {
        drawShape(ctx, {
          type: currentTool,
          points: [startPoint.x, startPoint.y, x, y],
          visible: true,
          label: "",
          id: "",
          strokeColor: "#FFFFFF",
          bgColor: "rgba(255, 255, 255, 0.3)",
          showStroke: true,
          showBackground: true,
        } as any);
      }
    }
  };

  // const renderTransformButton = (drawing: Drawing) => {
  //   if (!drawing.visible || currentTool !== "move") return null;

  //   const x = drawing.points[0] + (drawing.transform?.translate.x || 0);
  //   const y = drawing.points[1] + (drawing.transform?.translate.y || 0);

  //   return (
  //     <button
  //       className={`absolute p-1 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-move ${
  //         theme === "dark" ? "bg-white" : "bg-white"
  //       }`}
  //       style={{ left: x, top: y }}
  //       onMouseDown={(e) => {
  //         e.stopPropagation();
  //         setIsTransforming(true);
  //         setSelectedShape(drawing.id);
  //         setTransformOrigin({ x: e.clientX, y: e.clientY });
  //       }}
  //     >
  //       <Move size={12} color="black" />
  //     </button>
  //   );
  // };

  const endDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingPoint) {
      setIsDraggingPoint(false);
      setSelectedDrawingId(null);
      setSelectedPointIndex(null);
      setDraggedPointOffset(null);
      return;
    }

    if ((!isDrawing && !isPolygonDrawing) || !isAnnotationEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionPosition({ x, y });

    setDrawingHistory((history) => [...history, [...drawings]]);

    let newDrawing: Drawing | null = null;

    if (currentTool === "polygon") {
      if (e.detail === 2) {
        newDrawing = {
          type: "polygon",
          points: [...currentPoints],
          label: "",
          id: `drawing-${Date.now()}`,
          visible: true,
          strokeColor: "#FFFFFF",
          bgColor: "rgba(255, 255, 255, 0.3)",
          showStroke: true,
          OpenDrawer: false,
          showBackground: true,
          showLabel: false,
        };
        setIsPolygonDrawing(false);
        setCurrentPoints([]);
      }
    } else if (currentTool === "point") {
      newDrawing = {
        type: "point",
        points: [x, y],
        label: "",
        id: `drawing-${Date.now()}`,
        visible: true,
        strokeColor: "#FFFFFF",
        bgColor: "rgba(255, 255, 255, 0.3)",
        showStroke: true,
        OpenDrawer: false,
        showBackground: true,
        showLabel: false,
      };
      setIsDrawing(false);
    } else if (startPoint) {
      newDrawing = {
        type: currentTool,
        points: [startPoint.x, startPoint.y, x, y],
        label: "",
        id: `drawing-${Date.now()}`,
        visible: true,
        strokeColor: "#FFFFFF",
        bgColor: "rgba(255, 255, 255, 0.3)",
        showStroke: true,
        OpenDrawer: false,
        showBackground: true,
        showLabel: false,
      };
      setIsDrawing(false);
      setStartPoint(null);
    }

    if (newDrawing) {
      setDrawings([...drawings, newDrawing]);
      setShowSelecting(true);
    }
  };

  // const handleSelectionSubmit = (
  //   toothNumber: string,
  //   pathology: string,
  //   customPathology?: string
  // ) => {
  //   setDrawings((prev) => {
  //     const lastDrawing = prev[prev.length - 1];
  //     if (lastDrawing) {
  //       const label =
  //         pathology === "Other" && customPathology
  //           ? `${toothNumber}  ${customPathology}`
  //           : `${toothNumber}  ${pathology}`;

  //       const updatedDrawing = {
  //         ...lastDrawing,
  //         label,
  //         toothNumber,
  //         pathology,
  //         customPathology,
  //       };
  //       return [...prev.slice(0, -1), updatedDrawing];
  //     }
  //     return prev;
  //   });
  //   setShowSelecting(false);
  // };

  const processApiResponse = (responseData: UploadResponse) => {
    const classMap = new Map<string, Annotation>();

    // If it's tooth data, sort by class and use tooth-specific colors
    if (checkType === "tooth") {
             const toothColorMap = {
         "11": ["rgba(255, 0, 0, 0.4)", "rgba(255, 0, 0, 0.8)"],      // Red
         "12": ["rgba(0, 255, 0, 0.4)", "rgba(0, 255, 0, 0.8)"],      // Green
         "13": ["rgba(0, 0, 255, 0.4)", "rgba(0, 0, 255, 0.8)"],      // Blue
         "14": ["rgba(255, 255, 0, 0.4)", "rgba(255, 255, 0, 0.8)"],  // Yellow
         "15": ["rgba(255, 0, 255, 0.4)", "rgba(255, 0, 255, 0.8)"],  // Magenta
         "16": ["rgba(0, 255, 255, 0.4)", "rgba(0, 255, 255, 0.8)"],  // Cyan
         "17": ["rgba(255, 165, 0, 0.4)", "rgba(255, 165, 0, 0.8)"],  // Orange
         "18": ["rgba(128, 0, 128, 0.4)", "rgba(128, 0, 128, 0.8)"],  // Purple
         "21": ["rgba(255, 20, 147, 0.4)", "rgba(255, 20, 147, 0.8)"], // Deep Pink
         "22": ["rgba(0, 128, 0, 0.4)", "rgba(0, 128, 0, 0.8)"],      // Dark Green
         "23": ["rgba(128, 128, 0, 0.4)", "rgba(128, 128, 0, 0.8)"],  // Olive
         "24": ["rgba(255, 69, 0, 0.4)", "rgba(255, 69, 0, 0.8)"],    // Red Orange
         "25": ["rgba(138, 43, 226, 0.4)", "rgba(138, 43, 226, 0.8)"], // Blue Violet
         "26": ["rgba(75, 0, 130, 0.4)", "rgba(75, 0, 130, 0.8)"],    // Indigo
         "27": ["rgba(205, 92, 92, 0.4)", "rgba(205, 92, 92, 0.8)"],  // Indian Red
         "28": ["rgba(233, 150, 122, 0.4)", "rgba(233, 150, 122, 0.8)"], // Dark Salmon
         "31": ["rgba(255, 182, 193, 0.4)", "rgba(255, 182, 193, 0.8)"], // Light Pink
         "32": ["rgba(255, 105, 180, 0.4)", "rgba(255, 105, 180, 0.8)"], // Hot Pink
         "33": ["rgba(184, 134, 11, 0.4)", "rgba(184, 134, 11, 0.8)"],   // Dark Goldenrod
         "34": ["rgba(128, 128, 128, 0.4)", "rgba(128, 128, 128, 0.8)"], // Gray
         "35": ["rgba(169, 169, 169, 0.4)", "rgba(169, 169, 169, 0.8)"], // Dark Gray
         "36": ["rgba(148, 0, 211, 0.4)", "rgba(148, 0, 211, 0.8)"],     // Dark Violet
         "37": ["rgba(186, 85, 211, 0.4)", "rgba(186, 85, 211, 0.8)"],   // Medium Orchid
         "38": ["rgba(60, 179, 113, 0.4)", "rgba(60, 179, 113, 0.8)"],   // Medium Sea Green
         "41": ["rgba(255, 215, 0, 0.4)", "rgba(255, 215, 0, 0.8)"],     // Gold
         "42": ["rgba(0, 128, 255, 0.4)", "rgba(0, 128, 255, 0.8)"],     // Deep Sky Blue
         "43": ["rgba(192, 192, 192, 0.4)", "rgba(192, 192, 192, 0.8)"], // Silver
         "44": ["rgba(255, 20, 147, 0.4)", "rgba(255, 20, 147, 0.8)"],   // Deep Pink
         "45": ["rgba(34, 139, 34, 0.4)", "rgba(34, 139, 34, 0.8)"],     // Forest Green
         "46": ["rgba(219, 112, 147, 0.4)", "rgba(219, 112, 147, 0.8)"], // Pale Violet Red
         "47": ["rgba(218, 165, 32, 0.4)", "rgba(218, 165, 32, 0.8)"],   // Goldenrod
         "48": ["rgba(210, 105, 30, 0.4)", "rgba(210, 105, 30, 0.8)"],   // Chocolate
       };

      // Sort tooth results by class (low to high)
      const sortedResults = [...responseData.data.results].sort((a, b) => {
        const classA = parseInt(a.class);
        const classB = parseInt(b.class);
        return classA - classB;
      });

      sortedResults.forEach((result, index) => {
        const className = result.class;

        if (!classMap.has(className)) {
          classMap.set(className, {
            class: className,
            roi_xyxy: [],
          });
        }

        const annotation = classMap.get(className)!;
        const colors = toothColorMap[className as keyof typeof toothColorMap] || ["rgba(255, 0, 0, 0.3)", "rgba(255, 0, 0, 0.8)"];

        annotation.roi_xyxy.push({
          coordinates: result.roi_xyxy[0],
          poly: result.poly ? result.poly[0] : undefined,
          visible: true,
          id: `${className}-${index}`,
          label: (index + 1).toString(),
          strokeColor: colors[1],
          bgColor: colors[0],
          showStroke: true,
          showBackground: true,
          openDrawer: false,
          showLabel: false,
        });
      });
    } else {
      // For non-tooth data, use existing logic
      responseData.data.results.forEach((result, index) => {
        const className = result.class;

        if (!classMap.has(className)) {
          classMap.set(className, {
            class: className,
            roi_xyxy: [],
          });
        }

        const annotation = classMap.get(className)!;

        annotation.roi_xyxy.push({
          coordinates: result.roi_xyxy[0],
          poly: result.poly ? result.poly[0] : undefined,
          visible: true,
          id: `${className}-${index}`,
          label: (index + 1).toString(),
          strokeColor: classColors[className?.split(".")[1]]
            ? classColors[className?.split(".")[1]][1]
            : "rgb(255,0,0)",
          bgColor: classColors[className?.split(".")[1]]
            ? classColors[className?.split(".")[1]][0]
            : "rgba(255, 0, 0, 0.5)",
          showStroke: true,
          showBackground: checkType === "path" ? true : false,
          openDrawer: false,
          showLabel: false,
        });
      });
    }

    setAnnotations(Array.from(classMap.values()));
  };

  const drawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageSize.width || !imageSize.height) return;

    const imageElement = container.querySelector("img");
    if (!imageElement) return;

    const displayedWidth = imageElement.clientWidth;
    const displayedHeight = imageElement.clientHeight;

    canvas.width = displayedWidth;
    canvas.height = displayedHeight;
    canvas.style.width = `${displayedWidth}px`;
    canvas.style.height = `${displayedHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isAnnotationEnabled) return;

    const scaleX = displayedWidth / imageSize.width;
    const scaleY = displayedHeight / imageSize.height;

    annotations.forEach((annotation, _annIndex) => {
      annotation.roi_xyxy.forEach((coord) => {
        if (!coord.visible) return;

        if ((checkType === "path" || checkType === "tooth") && coord.poly && coord.poly.length > 0) {
          ctx.beginPath();
          const bgColor =
            coord.showBackground && coord.bgColor
              ? coord.bgColor
              : "transparent";
          ctx.fillStyle = bgColor;
          const strokeColor =
            coord.showStroke && coord.strokeColor
              ? coord.strokeColor
              : "transparent";
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 0.8;

          ctx.moveTo(coord.poly[0][0] * scaleX, coord.poly[0][1] * scaleY);
          for (let i = 1; i < coord.poly.length; i++) {
            ctx.lineTo(coord.poly[i][0] * scaleX, coord.poly[i][1] * scaleY);
          }
          ctx.closePath();
          if (coord.showBackground) ctx.fill();
          if (coord.showStroke) ctx.stroke();

          if (coord.showLabel) {
            const label = `${annotation.class}`.trim();
            if (label) {
              ctx.font = "12px Poppins";
              const textMetrics = ctx.measureText(label);
              const textHeight = 20;
              const labelX = coord.poly[0][0] * scaleX;
              const labelY = coord.poly[0][1] * scaleY;

              ctx.fillStyle =
                theme === "dark" ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.7)";
              ctx.fillRect(
                labelX,
                labelY - textHeight,
                textMetrics.width + 10,
                textHeight
              );

              ctx.fillStyle = "#FFFFFF";
              ctx.fillText(label, labelX + 5, labelY - 5);
            }
          }
        } else {
          const [x1, y1, x2, y2] = coord.coordinates;

          const scaledX1 = x1 * scaleX;
          const scaledY1 = y1 * scaleY;
          const scaledX2 = x2 * scaleX;
          const scaledY2 = y2 * scaleY;

          if (coord.showBackground && coord.bgColor) {
            ctx.fillStyle = coord.bgColor;
            ctx.fillRect(
              scaledX1,
              scaledY1,
              scaledX2 - scaledX1,
              scaledY2 - scaledY1
            );
          }

          if (coord.showStroke && coord.strokeColor) {
            ctx.strokeStyle = coord.strokeColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(
              scaledX1,
              scaledY1,
              scaledX2 - scaledX1,
              scaledY2 - scaledY1
            );
          }

          if (coord.showLabel) {
            const label = `${annotation.class}`.trim();
            if (label) {
              ctx.font = "12px Poppins";
              const textMetrics = ctx.measureText(label);
              const textHeight = 20;

              ctx.fillStyle =
                theme === "dark" ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.7)";
              ctx.fillRect(
                scaledX1,
                scaledY1 - textHeight,
                textMetrics.width + 10,
                textHeight
              );

              ctx.fillStyle = "#FFFFFF";
              ctx.fillText(label, scaledX1 + 5, scaledY1 - 5);
            }
          }
        }
      });
    });

    drawings.forEach((drawing) => drawShape(ctx, drawing));
  }, [annotations, isAnnotationEnabled, imageSize, drawings, checkType, theme]);

  const handleDownloadWithAnnotations = () => {
    if (!selectedFile) {
      toast.error("No image to download");
      return;
    }

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCanvas.width = imageSize.width;
    tempCanvas.height = imageSize.height;

    const img = new Image();
    img.onload = () => {
      const displayedImage = containerRef.current?.querySelector("img");
      if (!displayedImage) return;

      const displayedWidth = displayedImage.clientWidth;
      const displayedHeight = displayedImage.clientHeight;

      const scaleX = imageSize.width / displayedWidth;
      const scaleY = imageSize.height / displayedHeight;

      tempCtx.drawImage(img, 0, 0, imageSize.width, imageSize.height);

      if (isAnnotationEnabled) {
        annotations.forEach((annotation, _annIndex) => {
          annotation.roi_xyxy.forEach((coord) => {
            if (!coord.visible) return;

            if ((checkType === "path" || checkType === "tooth") && coord.poly && coord.poly.length > 0) {
              tempCtx.beginPath();
              const bgColor =
                coord.showBackground && coord.bgColor
                  ? coord.bgColor
                  : "transparent";
              tempCtx.fillStyle = bgColor;
              const strokeColor =
                coord.showStroke && coord.strokeColor
                  ? coord.strokeColor
                  : "transparent";
              tempCtx.strokeStyle = strokeColor;

              tempCtx.moveTo(coord.poly[0][0], coord.poly[0][1]);
              for (let i = 1; i < coord.poly.length; i++) {
                tempCtx.lineTo(coord.poly[i][0], coord.poly[i][1]);
              }
              tempCtx.closePath();
              if (coord.showBackground) tempCtx.fill();
              if (coord.showStroke) tempCtx.stroke();

              if (coord.showLabel) {
                const label = `${annotation.class}`;
                const textMetrics = tempCtx.measureText(label);
                const textHeight = 20;
                tempCtx.font = "12px Poppins";
                tempCtx.fillStyle =
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(0, 0, 0, 0.7)";
                tempCtx.fillRect(
                  coord.poly[0][0],
                  coord.poly[0][1] - textHeight,
                  textMetrics.width + 10,
                  textHeight
                );

                tempCtx.fillStyle = "#FFFFFF";
                tempCtx.fillText(
                  label,
                  coord.poly[0][0] + 5,
                  coord.poly[0][1] - 5
                );
              }
            } else {
              const [x1, y1, x2, y2] = coord.coordinates;

              const bgColor =
                coord.showBackground && coord.bgColor
                  ? coord.bgColor
                  : "transparent";

              if (coord.showBackground) {
                tempCtx.fillStyle = bgColor;
                tempCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
              }

              if (coord.showStroke && coord.strokeColor) {
                tempCtx.strokeStyle = coord.strokeColor;
                tempCtx.lineWidth = 2;
                tempCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
              }

              if (coord.showLabel) {
                const label = checkType === "qc" ? `${annotation.class} ${coord.label}` : `${annotation.class}`;
                tempCtx.font = "12px Poppins";
                const textMetrics = tempCtx.measureText(label);
                const textHeight = 20;

                tempCtx.fillStyle =
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(0, 0, 0, 0.7)";
                tempCtx.fillRect(
                  x1,
                  y1 - textHeight,
                  textMetrics.width + 10,
                  textHeight
                );

                tempCtx.fillStyle = "#FFFFFF";
                tempCtx.fillText(label, x1 + 5, y1 - 5);
              }
            }
          });
        });

        drawings.forEach((drawing) => {
          if (!drawing.visible) return;

          tempCtx.beginPath();
          tempCtx.strokeStyle =
            drawing.showStroke && drawing.strokeColor
              ? drawing.strokeColor
              : "transparent";
          tempCtx.fillStyle =
            drawing.showBackground && drawing.bgColor
              ? drawing.bgColor
              : "transparent";
          tempCtx.lineWidth = 2 * scaleX;
          tempCtx.font = `12px Poppins`;

          switch (drawing.type) {
            case "rectangle": {
              const scaledX1 = drawing.points[0] * scaleX;
              const scaledY1 = drawing.points[1] * scaleY;
              const scaledX2 = drawing.points[2] * scaleX;
              const scaledY2 = drawing.points[3] * scaleY;

              if (drawing.showBackground) {
                tempCtx.fillRect(
                  scaledX1,
                  scaledY1,
                  scaledX2 - scaledX1,
                  scaledY2 - scaledY1
                );
              }
              if (drawing.showStroke) {
                tempCtx.strokeRect(
                  scaledX1,
                  scaledY1,
                  scaledX2 - scaledX1,
                  scaledY2 - scaledY1
                );
              }

              if (drawing.showLabel && drawing.label) {
                const textMetrics = tempCtx.measureText(drawing.label);
                const textHeight = 20 * scaleY;
                tempCtx.fillStyle =
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(0, 0, 0, 0.7)";
                tempCtx.fillRect(
                  scaledX1,
                  scaledY1 - textHeight,
                  textMetrics.width + 10 * scaleX,
                  textHeight
                );
                tempCtx.fillStyle = "#FFFFFF";
                tempCtx.fillText(
                  drawing.label,
                  scaledX1 + 5 * scaleX,
                  scaledY1 - 5 * scaleY
                );
              }
              break;
            }
            case "line": {
              const scaledX1 = drawing.points[0] * scaleX;
              const scaledY1 = drawing.points[1] * scaleY;
              const scaledX2 = drawing.points[2] * scaleX;
              const scaledY2 = drawing.points[3] * scaleY;

              tempCtx.moveTo(scaledX1, scaledY1);
              tempCtx.lineTo(scaledX2, scaledY2);
              if (drawing.showStroke) tempCtx.stroke();

              if (drawing.showLabel && drawing.label) {
                const textMetrics = tempCtx.measureText(drawing.label);
                const textHeight = 20 * scaleY;
                tempCtx.fillStyle =
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(0, 0, 0, 0.7)";
                tempCtx.fillRect(
                  scaledX1,
                  scaledY1 - textHeight,
                  textMetrics.width + 10 * scaleX,
                  textHeight
                );
                tempCtx.fillStyle = "#FFFFFF";
                tempCtx.fillText(
                  drawing.label,
                  scaledX1 + 5 * scaleX,
                  scaledY1 - 5 * scaleY
                );
              }
              break;
            }
            case "point": {
              const scaledX = drawing.points[0] * scaleX;
              const scaledY = drawing.points[1] * scaleY;

              tempCtx.beginPath();
              tempCtx.arc(scaledX, scaledY, 3 * scaleX, 0, Math.PI * 2);
              if (drawing.showBackground) tempCtx.fill();
              if (drawing.showStroke) tempCtx.stroke();

              if (drawing.showLabel && drawing.label) {
                const textMetrics = tempCtx.measureText(drawing.label);
                const textHeight = 20 * scaleY;
                tempCtx.fillStyle =
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(0, 0, 0, 0.7)";
                tempCtx.fillRect(
                  scaledX,
                  scaledY - textHeight,
                  textMetrics.width + 10 * scaleX,
                  textHeight
                );
                tempCtx.fillStyle = "#FFFFFF";
                tempCtx.fillText(
                  drawing.label,
                  scaledX + 5 * scaleX,
                  scaledY - 5 * scaleY
                );
              }
              break;
            }
            case "polygon": {
              if (drawing.points.length >= 4) {
                const scaledPoints = drawing.points.map((point, index) =>
                  index % 2 === 0 ? point * scaleX : point * scaleY
                );

                if (scaledPoints.length >= 6) {
                  // Convert to [x, y] format for smooth polygon
                  const polygonPoints = [];
                  for (let i = 0; i < scaledPoints.length; i += 2) {
                    polygonPoints.push([scaledPoints[i], scaledPoints[i + 1]]);
                  }
                  
                  // Use smooth polygon drawing
                  drawEnhancedSmoothPolygon(tempCtx, polygonPoints, {
                    closed: true,
                    tension: 0.3,
                    fill: drawing.showBackground,
                    stroke: drawing.showStroke,
                    fillColor: drawing.bgColor || "rgba(255, 255, 255, 0.3)",
                    strokeColor: drawing.strokeColor || "#FFFFFF",
                    strokeWidth: 2,
                    shadowBlur: 2,
                    shadowColor: "rgba(0, 0, 0, 0.3)"
                  });
                } else {
                  // Fallback to regular polygon
                  tempCtx.moveTo(scaledPoints[0], scaledPoints[1]);
                  for (let i = 2; i < scaledPoints.length; i += 2) {
                    tempCtx.lineTo(scaledPoints[i], scaledPoints[i + 1]);
                  }
                  tempCtx.closePath();
                  if (drawing.showBackground) tempCtx.fill();
                  if (drawing.showStroke) tempCtx.stroke();
                }

                if (drawing.showLabel && drawing.label) {
                  const textMetrics = tempCtx.measureText(drawing.label);
                  const textHeight = 20 * scaleY;
                  tempCtx.fillStyle =
                    theme === "dark"
                      ? "rgba(0, 0, 0, 0.7)"
                      : "rgba(0, 0, 0, 0.7)";
                  tempCtx.fillRect(
                    scaledPoints[0],
                    scaledPoints[1] - textHeight,
                    textMetrics.width + 10 * scaleX,
                    textHeight
                  );
                  tempCtx.fillStyle = "#FFFFFF";
                  tempCtx.fillText(
                    drawing.label,
                    scaledPoints[0] + 5 * scaleX,
                    scaledPoints[1] - 5 * scaleY
                  );
                }
              }
              break;
            }
          }
        });
      }

      tempCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `annotated_${selectedFile.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success("Download completed");
        }
      }, "image/png");
    };

    img.src = URL.createObjectURL(selectedFile);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadResponse(null);
      setAnnotations([]);
      setSelectedFile(file);

      const img = new Image();
      img.onload = () => {
        setImageSize({
          width: img.width,
          height: img.height,
        });
      };
      img.src = URL.createObjectURL(file);
    }
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".png", ".gif", ".jpg"],
    },
    multiple: false,
  });

  useEffect(() => {
    drawAnnotations();
  }, [drawAnnotations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.cursor =
      currentTool === "select"
        ? "default"
        : currentTool === "move" || currentTool === "reshape"
        ? "grab"
        : "crosshair";
  }, [currentTool]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isTransforming) {
        setIsTransforming(false);
        setSelectedShape(null);
        setTransformOrigin(null);
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isTransforming]);

  useEffect(() => {
    if (selectedFile) {
      handleUpload();
    }
  }, [checkType, selectedFile]);

  const bgColor = theme === "dark" ? "bg-zinc-900" : "bg-gray-100";
  const borderColorForLoader =
    theme === "dark" ? "border-white" : "border-black";
  const textColor = theme === "dark" ? "text-zinc-100" : "text-gray-900";
  const barBgColor = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const borderColor = theme === "dark" ? "border-zinc-700" : "border-gray-200";
  const buttonHoverColor =
    theme === "dark" ? "hover:bg-zinc-700" : "hover:bg-gray-200";
  const buttonSelectColor = theme === "dark" ? "bg-zinc-700" : "bg-gray-200";
  const secondaryTextColor =
    theme === "dark" ? "text-zinc-400" : "text-gray-500";
  const panelBgColor = theme === "dark" ? "bg-zinc-800" : "bg-gray-50";

  return (
    <div
      className={`flex flex-col font-poppins h-screen ${bgColor} ${textColor}`}
    >
      <div
        className={`flex items-center justify-between p-2 ${barBgColor} ${borderColor} border-b`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <img src="/vi-ai-favicon.svg" alt="" className="h-6 bg-contain" />
            <span className="font-semibold">VI.AI</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`p-2 max-[400px]:hidden text-xs ${buttonHoverColor} rounded-full flex items-center gap-1`}
                    >
                      <span className="max-sm:hidden">Switch to</span>
                      <span>
                        {checkTypeOptions.find(option => option.value === checkType)?.label || "QC"}
                      </span>
                      <ChevronDown size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {checkTypeOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => setCheckType(option.value as "qc" | "path" | "tooth")}
                        className={`cursor-pointer ${
                          checkType === option.value ? "bg-accent" : ""
                        }`}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="px-3 py-1.5 text-xs font-medium shadow-lg"
              >
                Switch Check Type
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`p-2 ${buttonHoverColor} rounded-full`}
                    onClick={toggleTheme}
                  >
                    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="px-3 py-1.5 text-sm font-medium shadow-lg"
                >
                  Switch to {theme === "dark" ? "Light" : "Dark"} Mode
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`p-2 ${buttonHoverColor} rounded-full`}
                    onClick={handleUpload}
                  >
                    <Play size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="px-3 py-1.5 text-sm font-medium shadow-lg"
                >
                  Run AI Analysis
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className={`p-2 ${buttonHoverColor} rounded-full`}>
                    <Maximize2 size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="px-3 py-1.5 text-sm font-medium shadow-lg"
                >
                  Enter Fullscreen
                </TooltipContent>
              </Tooltip>
            </TooltipProvider> */}

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={()=>navigate('layer')} className={`p-2 ${buttonHoverColor} rounded-full`}>
                    <TbSwitch3 size={18} />
                    {/* <Settings size={18} /> */}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="px-3 py-1.5 text-sm font-medium shadow-lg"
                >
                  Switch To Layer View
                  {/* Open Settings */}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      <div className="min-[400px]:hidden flex justify-center ">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`p-2 text-xs ${buttonHoverColor} rounded-full flex items-center gap-1`}
                  >
                    Switch to {checkTypeOptions.find(option => option.value === checkType)?.label || "QC"}
                    <ChevronDown size={12} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-40">
                  {checkTypeOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setCheckType(option.value as "qc" | "path" | "tooth")}
                      className={`cursor-pointer ${
                        checkType === option.value ? "bg-accent" : ""
                      }`}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="px-3 py-1.5 text-xs font-medium shadow-lg"
            >
              Switch Check Type
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div
        className={`flex items-center p-1 gap-1 ${barBgColor} ${borderColor} border-b overflow-x-auto scrollbar-hide`}
      >
        <ToolButton
          icon={<Undo size={16} />}
          label="Undo"
          theme={theme}
          onClick={handleUndo}
        />
        <ToolButton
          icon={<MousePointer size={16} />}
          label="Select"
          theme={theme}
          onClick={() => {
            setCurrentTool("select");
            setIsDrawing(false);
            setIsPolygonDrawing(false);
            setIsTransforming(false);
          }}
        />
        <ToolButton
          icon={<Move size={16} />}
          label="Move"
          theme={theme}
          onClick={() => {
            setCurrentTool("move");
            setIsDrawing(false);
            setIsPolygonDrawing(false);
          }}
        />
        <ToolButton
          icon={<SquarePen size={16} />}
          label="Reshape"
          theme={theme}
          onClick={() => {
            setCurrentTool("reshape");
            setIsDrawing(false);
            setIsPolygonDrawing(false);
            setIsTransforming(false);
          }}
        />
        <ToolButton
          icon={<Square size={16} />}
          label="Rectangle"
          theme={theme}
          onClick={() => {
            setCurrentTool("rectangle");
            setIsTransforming(false);
          }}
        />
        <ToolButton
          icon={<Minus size={16} />}
          label="Line"
          theme={theme}
          onClick={() => {
            setCurrentTool("line");
            setIsTransforming(false);
          }}
        />
        <ToolButton
          icon={<Dot size={16} />}
          label="Point"
          theme={theme}
          onClick={() => {
            setCurrentTool("point");
            setIsTransforming(false);
          }}
        />
        <ToolButton
          icon={<BsBoundingBoxCircles size={16} />}
          label="Polygon"
          theme={theme}
          onClick={() => {
            setCurrentTool("polygon");
            setIsTransforming(false);
          }}
        />
        <ToolButton icon={<Ruler size={16} />} label="Measure" theme={theme} />
        <div className={`h-6 border-l ${borderColor} mx-1`}></div>
        <ToolButton
          icon={<Download size={16} />}
          label="Export"
          theme={theme}
          onClick={handleDownloadWithAnnotations}
        />
        <ToolButton
          icon={<ImageMinus size={16} />}
          label="Remove"
          theme={theme}
          onClick={handleRemoveImage}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`w-10 ${panelBgColor} ${borderColor} border-r flex flex-col items-center py-2 gap-3`}
        >
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`p-2 rounded-full ${buttonHoverColor} ${
                    isAnnotationEnabled ? buttonSelectColor : ""
                  }`}
                  onClick={() => setIsAnnotationEnabled(!isAnnotationEnabled)}
                >
                  <Highlighter size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="px-3 py-1.5 text-sm font-medium shadow-lg"
              >
                {isAnnotationEnabled ? "Off" : "On"} Annotation
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

           {/* <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button  className={`p-2 rounded-full ${buttonHoverColor}`}>
                  <Logs size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="px-3 py-1.5 text-sm font-medium shadow-lg"
              >
                Switch to Layer Based Viewer
              </TooltipContent>
            </Tooltip>
          </TooltipProvider> */}

          {/* <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button  className={`p-2 rounded-full ${buttonHoverColor}`}>
                  <Layers size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="px-3 py-1.5 text-sm font-medium shadow-lg"
              >
                Switch to Layer Based Viewer
              </TooltipContent>
            </Tooltip>
          </TooltipProvider> */}

          {/* <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className={`p-2 rounded-full ${buttonHoverColor}`}>
                  <FileText size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="px-3 py-1.5 text-sm font-medium shadow-lg"
              >
                Reports & Documents
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className={`p-2 rounded-full ${buttonHoverColor}`}>
                  <Search size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="px-3 py-1.5 text-sm font-medium shadow-lg"
              >
                Search Features
              </TooltipContent>
            </Tooltip>
          </TooltipProvider> */}
        </div>

        <div
          className="flex justify-center relative overflow-scroll scrollbar-hide"
          style={{ width: "calc(100% - 4.5rem)"}}
        >
          {isLoading && (
            <div
              className={`absolute z-50 inset-0 flex items-center justify-center ${bgColor} bg-opacity-50`}
            >
              <div
                className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${borderColorForLoader}`}
              ></div>
            </div>
          )}

          <div
            {...(!selectedFile ? getRootProps() : {})}
            className={`text-center relative h-full flex items-center justify-center ${
              isDragActive ? "bg-gray-700" : ""
            } ${isDragReject ? "border-red-500" : ""}`}
            ref={containerRef}
          >
            {selectedFile ? (
              <>
                <p
                  className={`${secondaryTextColor} text-xs mb-2 absolute top-2 left-0 right-0`}
                >
                  {"< " + selectedFile.name + " >"}
                </p>
                <div className="relative inline-block">
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="Uploaded Scan"
                    className="max-h-[90vh] max-w-full object-contain"
                    style={{ width: "auto", height: "auto" }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0"
                    style={{
                      width: "100%",
                      height: "100%",
                      cursor:
                        currentTool === "select"
                          ? "default"
                          : currentTool === "move" || currentTool === "reshape"
                          ? "grab"
                          : "crosshair",
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={() => {
                      setIsDrawing(false);
                      drawAnnotations();
                    }}
                  />
                  {/* {drawings.map((drawing) => renderTransformButton(drawing))} */}
                </div>
              </>
            ) : (
              <>
                <input {...getInputProps()} />
                <div className="flex flex-col  items-center justify-center">
                  <MdOutlineCloudUpload
                    size={64}
                    className={
                      theme === "dark" ? "text-zinc-600" : "text-gray-400"
                    }
                  />
                  <p className={`max-sm:text-xs text-sm ${secondaryTextColor}`}>
                    {isDragActive
                      ? "Drop the image here ..."
                      : "Drag and drop an image here, or click to select a file"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div
          className={`transition-all duration-300 fixed right-0 h-svh ease-in-out ${
            infoPanelOpen ? "max-[400px]:w-full w-80" : "w-8"
          } ${panelBgColor} ${borderColor} border-l flex flex-col`}
        >
          <button
            onClick={() => setInfoPanelOpen(!infoPanelOpen)}
            className={`p-2 ${buttonHoverColor} flex justify-center items-center h-10 border-b ${borderColor}`}
          >
            {infoPanelOpen ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>

          {infoPanelOpen && (
            <div className="p-3 flex-1 overflow-y-auto scrollbar-hide">
              <h3 className="font-medium mb-3">Annotations</h3>

              <Tabs defaultValue="OPG" className="w-full">
                <TabsList
                  className={`grid w-full grid-cols-2 border ${
                    theme === "dark" ? "border-zinc-600" : "border-gray-200"
                  }`}
                >
                  <TabsTrigger value="OPG">OPG</TabsTrigger>
                  <TabsTrigger value="MARKINGS">MARKINGS</TabsTrigger>
                </TabsList>
                <TabsContent value="OPG" className="mt-2">
                  <RenderOPGAnnotationsList
                    annotations={annotations}
                    theme={theme}
                    editingId={editingId}
                    setEditingId={setEditingId}
                    setAnnotations={setAnnotations}
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    checkType={checkType}
                  />
                </TabsContent>
                <TabsContent value="MARKINGS" className="mt-2">
                  <RenderCustomAnnotationsList
                    drawings={drawings}
                    theme={theme}
                    setDrawings={setDrawings}
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
