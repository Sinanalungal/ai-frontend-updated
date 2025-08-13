import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Highlighter,
  Play,
  Minimize,
  Layers,
  Undo,
  MousePointer,
  Move,
  SquarePen,
  Square,
  Minus,
  Dot,
  Download,
  ImageMinus,
} from "lucide-react";
import { BsBoundingBoxCircles } from "react-icons/bs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import axios from "axios";
import { toast } from "sonner";
import { classColors } from "@/constants/teethRelated";
import { MdOutlineCloudUpload } from "react-icons/md";
import { useDropzone } from "react-dropzone";
import LayerOptions from "./LayerOptions";
import LayerActionMenu from "./LayerActionMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RenderOPGAnnotationsList from "../Viewer/RenderOpgAnnotationsList";
import RenderCustomAnnotationsList from "../Viewer/RenderCustomAnnotationsList";
import { ToolButton } from "../Viewer/ToolButton";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { checkTypeOptions } from "@/constants/teethRelated";

const SNAP_THRESHOLD = 10;

interface Annotation {
  class: string;
  roi_xyxy: {
    coordinates: number[];
    poly?: number[][];
    visible: boolean;
    id: string;
    label: string;
    strokeColor: string;
    bgColor: string;
    showStroke: boolean;
    showBackground: boolean;
    showLabel: boolean;
    openDrawer: boolean;
  }[];
}

interface Drawing {
  type: "rectangle" | "line" | "point" | "polygon";
  points: number[];
  visible: boolean;
  strokeColor: string;
  bgColor: string;
  showStroke: boolean;
  showBackground: boolean;
  label: string;
  id: string;
  transform?: { scale: number; rotation: number; translate: { x: number; y: number } };
  toothNumber?: string;
  pathology?: string;
  customPathology?: string;
  showLabel: boolean;
}

interface UploadResponse {
  data: {
    results: {
      class: string;
      roi_xyxy: number[][];
      poly?: number[][][];
    }[];
  };
}

interface Layer {
  id: number;
  file: File | null;
  annotationsQc: Annotation[] | null;
  annotationsPath: Annotation[] | null;
  annotationsTooth: Annotation[] | null;
  drawings: Drawing[];
  drawingHistory: Drawing[][];
  responseQc: UploadResponse | null;
  responsePath: UploadResponse | null;
  responseTooth: UploadResponse | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  checkType: "qc" | "path" | "tooth";
  // openDrawer:boolean,
}

export default function LayerViewer() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<number>(0);
  const [isAnnotationEnabled, setIsAnnotationEnabled] = useState(true);
  const [currentTool, setCurrentTool] = useState<
    "select" | "move" | "reshape" | "rectangle" | "line" | "point" | "polygon" | "measure"
  >("select");
  const [isLoading, setIsLoading] = useState<boolean[]>([false]);
  const [imageSizes, setImageSizes] = useState<{ width: number; height: number }[]>([{ width: 0, height: 0 }]);
  const [layers, setLayers] = useState<Layer[]>([
    {
      id: 0,
      file: null,
      annotationsQc: null,
      annotationsPath: null,
      annotationsTooth: null,
      drawings: [],
      drawingHistory: [],
      responseQc: null,
      responsePath: null,
      responseTooth: null,
      canvasRef: React.createRef<any>(),
      containerRef: React.createRef<any>(),
      checkType: "qc",
    },
  ]);
  const [fullScreenLayer, setFullScreenLayer] = useState<Layer | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [isPolygonDrawing, setIsPolygonDrawing] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [transformOrigin, setTransformOrigin] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [draggedPointOffset, setDraggedPointOffset] = useState<{ x: number; y: number } | null>(null);
  const [showSelecting, setShowSelecting] = useState(false);
  const [_selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  console.log("Layers:", layers);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  

  const handleRemoveImage = (layerId: number) => {
    setLayers((prevLayers) => {
      const updatedLayers = prevLayers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              file: null,
              annotationsQc: null,
              annotationspath: null,
              drawings: [],
              drawingHistory: [],
              responseQc: null,
              responsePath: null,
            }
          : layer
      );

      setImageSizes((prevSizes) =>
        prevSizes.map((size, index) => {
          const layer = updatedLayers[index];
          if (!layer) return size;
          return layer.id === layerId ? { width: 0, height: 0 } : size;
        })
      );

      return updatedLayers;
    });

    setIsDrawing(false);
    setIsPolygonDrawing(false);
    setCurrentPoints([]);

    if (fullScreenLayer?.id === layerId) {
      setFullScreenLayer(null);
    }
  };

  const handleUndo = () => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === selectedLayer && layer.drawingHistory.length > 0
          ? {
              ...layer,
              drawings: layer.drawingHistory[layer.drawingHistory.length - 1],
              drawingHistory: layer.drawingHistory.slice(0, -1),
            }
          : layer
      )
    );
    if (showSelecting) {
      setShowSelecting(false);
    }
  };

  const handleUpload = async () => {
    const layer = layers?.find((l) => l.id === selectedLayer);
    if (!layer?.file) return;

    // Close the drawer when loading starts
    setInfoPanelOpen(false);

    setIsLoading((prev) => {
      const newLoading = [...prev];
      newLoading[selectedLayer] = true;
      return newLoading;
    });

    const formData = new FormData();
    formData.append("file", layer.file);
    
    try {
      // Call QC API
      formData.append("model_name", "qc");
      const resQc = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/inference/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "ngrok-skip-browser-warning": "1",
          },
        }
      );

      // Call Pathology API
      formData.set("model_name", "path");
      const resPath = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/inference/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "ngrok-skip-browser-warning": "1",
          },
        }
      );

      // Call Tooth API
      formData.set("model_name", "tooth");
      const resTooth = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/inference/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "ngrok-skip-browser-warning": "1",
          },
        }
      );

      const responseDataQc = resQc.data as UploadResponse;
      const responseDataPath = resPath.data as UploadResponse;
      const responseDataTooth = resTooth.data as UploadResponse;
      processApiResponse(responseDataQc, responseDataPath, responseDataTooth);
    } catch (error) {
      console.error(error);
      toast.error("Failed to process image");
    } finally {
      setIsLoading((prev) => {
        const newLoading = [...prev];
        newLoading[selectedLayer] = false;
        return newLoading;
      });
    }
  };

  const processApiResponse = (responseDataQc: UploadResponse, responseDataPath: UploadResponse, responseDataTooth: UploadResponse) => {
    const classMapQc = new Map<string, Annotation>();
    const classMapPath = new Map<string, Annotation>();
    const classMapTooth = new Map<string, Annotation>();
  
    // Process Qc
    responseDataQc.data.results.forEach((result, index) => {
      const className = result.class;
  
      if (!classMapQc.has(className)) {
        classMapQc.set(className, {
          class: className,
          roi_xyxy: [],
        });
      }
  
      const annotation = classMapQc.get(className)!;
  
      annotation.roi_xyxy.push({
        coordinates: result.roi_xyxy[0],
        poly: result.poly ? result.poly[0] : undefined,
        visible: true,
        id: `${className}-qc-${index}`,
        label: (index + 1).toString(),
        strokeColor: classColors[className?.split(".")[1]]?.[1] || "#FF0000",
        bgColor: classColors[className?.split(".")[1]]?.[0] || "rgba(255, 0, 0, 0.5)",
        showStroke: true,
        showBackground: layers?.find((l) => l.id === selectedLayer)?.checkType === "path" || layers?.find((l) => l.id === selectedLayer)?.checkType === "tooth",
        showLabel: false,
        openDrawer: false
      });
    });
  
    // Process Path
    responseDataPath.data.results.forEach((result, index) => {
      const className = result.class;
  
      if (!classMapPath.has(className)) {
        classMapPath.set(className, {
          class: className,
          roi_xyxy: [],
        });
      }
  
      const annotation = classMapPath.get(className)!;
  
      annotation.roi_xyxy.push({
        coordinates: result.roi_xyxy[0],
        poly: result.poly ? result.poly[0] : undefined,
        visible: true,
        id: `${className}-path-${index}`,
        label: (index + 1).toString(),
        strokeColor: classColors[className?.split(".")[1]]?.[1] || "#FF0000",
        bgColor: classColors[className?.split(".")[1]]?.[0] || "rgba(255, 0, 0, 0.5)",
        showStroke: true,
        showBackground: true,
        showLabel: false,
        openDrawer: false
      });
    });

         // Process Tooth with different colors and sorting
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
    const sortedToothResults = [...responseDataTooth.data.results].sort((a, b) => {
      const classA = parseInt(a.class);
      const classB = parseInt(b.class);
      return classA - classB;
    });

    sortedToothResults.forEach((result, index) => {
      const className = result.class;
  
      if (!classMapTooth.has(className)) {
        classMapTooth.set(className, {
          class: className,
          roi_xyxy: [],
        });
      }
  
      const annotation = classMapTooth.get(className)!;
               const colors = toothColorMap[className as keyof typeof toothColorMap] || ["rgba(255, 0, 0, 0.4)", "rgba(255, 0, 0, 0.8)"];
  
      annotation.roi_xyxy.push({
        coordinates: result.roi_xyxy[0],
        poly: result.poly ? result.poly[0] : undefined,
        visible: true,
        id: `${className}-tooth-${index}`,
        label: (index + 1).toString(),
        strokeColor: colors[1],
        bgColor: colors[0],
        showStroke: true,
        showBackground: true,
        showLabel: false,
        openDrawer: false
      });
    });
  
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === selectedLayer
          ? {
              ...layer,
              annotationsQc: Array.from(classMapQc.values()),
              annotationsPath: Array.from(classMapPath.values()),
              annotationsTooth: Array.from(classMapTooth.values()),
              responseQc: responseDataQc,
              responsePath: responseDataPath,
              responseTooth: responseDataTooth,
            }
          : layer
      )
    );
  };
  

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      try {
        const file = acceptedFiles[0];
        if (!file) {
          toast.error("No file selected");
          return;
        }

        if (!file.type.startsWith("image/")) {
          toast.error("Please upload an image file");
          return;
        }

        const img = new Image();
        img.onload = () => {
          setImageSizes((prev) =>
            prev.map((size, index) => {
              const layer = layers[index];
              if (!layer) return size;
              return layer.id === selectedLayer
                ? { width: img.width, height: img.height }
                : size;
            })
          );

          setLayers((prev) =>
            prev.map((layer) =>
              layer.id === selectedLayer
                ? {
                    ...layer,
                    file,
                    annotationsQc: null,
                    annotationsPath: null,
                    drawings: [],
                    drawingHistory: [],
                    responseQc: null,
                    responsePath: null,
                  }
                : layer
            )
          );
        };

        img.onerror = () => {
          toast.error("Failed to load image");
        };

        img.src = URL.createObjectURL(file);
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload image");
      }
    },
    [selectedLayer, layers]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".png", ".gif", ".jpg"] },
    multiple: false,
  });

  const drawShape = (
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    scaleX: number,
    scaleY: number
  ) => {
    if (!drawing.visible) return;

    ctx.beginPath();
    ctx.strokeStyle = drawing.showStroke ? drawing.strokeColor : "transparent";
    ctx.fillStyle = drawing.showBackground ? drawing.bgColor : "transparent";
    ctx.lineWidth = 2;

    const points = drawing.points;
    switch (drawing.type) {
      case "rectangle":
        if (drawing.showBackground) {
          ctx.fillRect(
            points[0] * scaleX,
            points[1] * scaleY,
            (points[2] - points[0]) * scaleX,
            (points[3] - points[1]) * scaleY
          );
        }
        if (drawing.showStroke) {
          ctx.strokeRect(
            points[0] * scaleX,
            points[1] * scaleY,
            (points[2] - points[0]) * scaleX,
            (points[3] - points[1]) * scaleY
          );
        }
        break;
      case "line":
        ctx.moveTo(points[0] * scaleX, points[1] * scaleY);
        ctx.lineTo(points[2] * scaleX, points[3] * scaleY);
        if (drawing.showStroke) ctx.stroke();
        break;
      case "point":
        ctx.arc(points[0] * scaleX, points[1] * scaleY, 3, 0, Math.PI * 2);
        if (drawing.showBackground) ctx.fill();
        if (drawing.showStroke) ctx.stroke();
        break;
      case "polygon":
        ctx.moveTo(points[0] * scaleX, points[1] * scaleY);
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i] * scaleX, points[i + 1] * scaleY);
        }
        ctx.closePath();
        if (drawing.showBackground) ctx.fill();
        if (drawing.showStroke) ctx.stroke();
        break;
    }

    if (drawing.label && drawing.showLabel) {
      ctx.font = "12px Poppins";
      const textMetrics = ctx.measureText(drawing.label);
      ctx.fillStyle =
        theme === "dark" ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(
        points[0] * scaleX,
        points[1] * scaleY - 20,
        textMetrics.width + 10,
        20
      );
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(
        drawing.label,
        points[0] * scaleX + 5,
        points[1] * scaleY - 5
      );
    }
  };

  const findNearestPoint = (x: number, y: number, drawings: Drawing[]) => {
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

  const isPointInPolygon = (x: number, y: number, points: number[]) => {
    let vertices: number[][] = [];
    for (let i = 0; i < points.length; i += 2) {
      vertices.push([points[i], points[i + 1]]);
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
    scaleY: number,
    layer: Layer
  ) => {    
    const annotateList = layer.checkType === "qc" ? layer?.annotationsQc : layer.checkType === "path" ? layer?.annotationsPath : layer?.annotationsTooth;
    for (const annotation of annotateList ||[]) {
      for (const coord of annotation.roi_xyxy) {
        if (!coord.visible) continue;

        if ((layer.checkType === "path" || layer.checkType === "tooth") && coord.poly && coord.poly.length > 0) {
          const scaledPoly = coord.poly.map(([px, py]) => [
            px * scaleX,
            py * scaleY,
          ]);
          const flattenedPoly = scaledPoly.flat();
          if (isPointInPolygon(x, y, flattenedPoly)) {
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

    for (const drawing of layer.drawings) {
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

  const handleShapeClick = (
    e: React.MouseEvent<HTMLCanvasElement>,
    targetLayer: Layer
  ) => {
    console.log('======================');
    
    const canvas = targetLayer.canvasRef.current;
    if (!canvas) return;
  
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
  
    const imageElement = targetLayer.containerRef.current?.querySelector("img");
    if (!imageElement) return;
  
    const displayedWidth = imageElement.getBoundingClientRect().width;
    const displayedHeight = imageElement.getBoundingClientRect().height;
    const layerIndex = layers?.findIndex((l) => l.id === targetLayer.id);
    const imageSize = imageSizes[layerIndex];
    if (!imageSize || !imageSize.width || !imageSize.height) return;
  
    const scaleX = displayedWidth / imageSize.width;
    const scaleY = displayedHeight / imageSize.height;
  
    const shape = findShapeAtPoint(x, y, scaleX, scaleY, targetLayer);  
    // console.log(shape);
      
  
    if (shape) {
      if (shape.type === "annotation") {
        setLayers((prev) =>
          prev.map((layer) =>
            layer.id === targetLayer.id
              ? {
                  ...layer,
                  [layer.checkType === "qc" ? "annotationsQc" : layer.checkType === "path" ? "annotationsPath" : "annotationsTooth"]:
                    (layer.checkType === "qc" ? layer.annotationsQc : layer.checkType === "path" ? layer.annotationsPath : layer.annotationsTooth)?.map(
                      (annotation) => {
                        if (annotation.class !== shape.className) return annotation;
                        return {
                          ...annotation,
                          roi_xyxy: annotation.roi_xyxy.map((coord) => {
                            if (coord.id !== shape.coordId) return coord;
                            return { ...coord, showLabel: !coord.showLabel };
                          }),
                        };
                      }
                    ),
                }
              : layer
          )
        );        
      } else if (shape.type === "drawing") {
        setLayers((prev) =>

          prev.map((layer) =>
            layer.id === targetLayer.id
              ? {
                  ...layer,
                  drawings: layer.drawings.map((drawing) => {
                    if (drawing.id !== shape.drawingId) return drawing;
                    
                    return { ...drawing, showLabel: !drawing.showLabel };
                  }),
                }
              : layer
          )
        );
      }
      drawAnnotations(targetLayer.id);
    }
  };
  
  const drawAnnotations = useCallback(
    (layerId?: number) => {
      const layersToDraw =
        layerId !== undefined
          ? [layers?.find((l) => l.id === layerId)].filter(
              (l): l is Layer => l !== undefined
            )
          : layers;

      layersToDraw.forEach((layer) => {
        const canvas = layer.canvasRef.current;
        const container = layer.containerRef.current;
        const layerIndex = layers?.findIndex((l) => l.id === layer.id);
        const imageSize = imageSizes[layerIndex];

        if (
          !canvas ||
          !container ||
          !imageSize ||
          !imageSize.width ||
          !imageSize.height
        )
          return;

        const imageElement = container.querySelector("img");
        if (!imageElement) return;

        const displayedWidth = imageElement.getBoundingClientRect().width;
        const displayedHeight = imageElement.getBoundingClientRect().height;

        canvas.width = displayedWidth * window.devicePixelRatio;
        canvas.height = displayedHeight * window.devicePixelRatio;
        canvas.style.width = `${displayedWidth}px`;
        canvas.style.height = `${displayedHeight}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.clearRect(0, 0, displayedWidth, displayedHeight);

        if (!isAnnotationEnabled) return;

        const scaleX = displayedWidth / imageSize.width;
        const scaleY = displayedHeight / imageSize.height;

        const annotateList =
        layer.checkType === "qc" ? layer?.annotationsQc : layer.checkType === "path" ? layer?.annotationsPath : layer?.annotationsTooth;

        annotateList?.forEach((annotation) => {
          annotation.roi_xyxy.forEach((coord) => {
            if (!coord.visible) return;

            if ((layer.checkType === "path" || layer.checkType === "tooth") && coord.poly && coord.poly.length > 0) {
              ctx.beginPath();
              ctx.fillStyle = coord.showBackground ? coord.bgColor : "transparent";
              ctx.strokeStyle = coord.showStroke ? coord.strokeColor : "transparent";
              ctx.lineWidth = 0.8;

              ctx.moveTo(coord.poly[0][0] * scaleX, coord.poly[0][1] * scaleY);
              for (let i = 1; i < coord.poly.length; i++) {
                ctx.lineTo(
                  coord.poly[i][0] * scaleX,
                  coord.poly[i][1] * scaleY
                );
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
                  ctx.font = "10px Poppins";
                  const textMetrics = ctx.measureText(label);
                  const labelWidth = textMetrics.width + 10;
                  const labelHeight = 20;

                  let labelX = scaledX1;
                  let labelY = scaledY1 - labelHeight;

                  if (labelX + labelWidth > displayedWidth) {
                    labelX = displayedWidth - labelWidth - 5;
                  }
                  if (labelX < 0) {
                    labelX = 5;
                  }
                  if (labelY < 0) {
                    labelY = scaledY1 + 5;
                  }

                  ctx.fillStyle =
                    theme === "dark" ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.7)";
                  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

                  ctx.fillStyle = "#FFFFFF";
                  ctx.fillText(label, labelX + 5, labelY + 15);
                }
              }
            }
          });
        });

        layer.drawings.forEach((drawing) =>
          drawShape(ctx, drawing, scaleX, scaleY)
        );

        if (
          (isDrawing || isPolygonDrawing) &&
          currentPoints.length >= 2 &&
          layer.id === (fullScreenLayer ? fullScreenLayer.id : selectedLayer)
        ) {
          ctx.beginPath();
          ctx.strokeStyle = "#FF0000";
          ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
          ctx.lineWidth = 1;

          if (currentTool === "rectangle") {
            ctx.strokeRect(
              currentPoints[0] * scaleX,
              currentPoints[1] * scaleY,
              (currentPoints[2] - currentPoints[0]) * scaleX,
              (currentPoints[3] - currentPoints[1]) * scaleY
            );
            ctx.fillRect(
              currentPoints[0] * scaleX,
              currentPoints[1] * scaleY,
              (currentPoints[2] - currentPoints[0]) * scaleX,
              (currentPoints[3] - currentPoints[1]) * scaleY
            );
          } else if (currentTool === "line") {
            ctx.moveTo(currentPoints[0] * scaleX, currentPoints[1] * scaleY);
            ctx.lineTo(currentPoints[2] * scaleX, currentPoints[3] * scaleY);
            ctx.stroke();
          } else if (currentTool === "polygon") {
            ctx.moveTo(currentPoints[0] * scaleX, currentPoints[1] * scaleY);
            for (let i = 2; i < currentPoints.length; i += 2) {
              ctx.lineTo(
                currentPoints[i] * scaleX,
                currentPoints[i + 1] * scaleY
              );
            }
            ctx.stroke();
          }
        }
      });
    },
    [
      layers,
      selectedLayer,
      isAnnotationEnabled,
      imageSizes,
      theme,
      fullScreenLayer,
      isDrawing,
      isPolygonDrawing,
      currentPoints,
      currentTool,
    ]
  );

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        drawAnnotations();
      });
    });

    layers.forEach((layer) => {
      if (layer.containerRef.current) {
        resizeObserver.observe(layer.containerRef.current);
        const img = layer.containerRef.current.querySelector("img");
        if (img) {
          resizeObserver.observe(img);
        }
      }
    });

    return () => {
      layers.forEach((layer) => {
        if (layer.containerRef.current) {
          resizeObserver.unobserve(layer.containerRef.current);
          const img = layer.containerRef.current.querySelector("img");
          if (img) {
            resizeObserver.unobserve(img);
          }
        }
      });
      resizeObserver.disconnect();
    };
  }, [layers, drawAnnotations]);

  useEffect(() => {
    drawAnnotations();
  }, [imageSizes, layers, fullScreenLayer, drawAnnotations]);

  const handleDeleteLayer = (id: number) => {
    if (layers?.length === 1) {
      toast.error("Cannot delete the last layer");
      return;
    }

    setLayers((prevLayers) => {
      const updatedLayers = prevLayers?.filter((layer) => layer.id !== id);

      setImageSizes((prevSizes) =>
        prevSizes.filter((_, index) => updatedLayers[index]?.id !== id)
      );

      if (selectedLayer === id) {
        setSelectedLayer(updatedLayers?.length > 0 ? updatedLayers[0].id : 0);
      }

      return updatedLayers;
    });

    if (fullScreenLayer?.id === id) {
      setFullScreenLayer(null);
    }
  };

  const addLayer = () => {
    setLayers((prevLayers) => {
      if (prevLayers?.length >= 6) {
        toast.error("Maximum of 6 layers allowed");
        return prevLayers;
      }

      const lastId =
        prevLayers?.length > 0 ? prevLayers[prevLayers?.length - 1].id : 0;
      const newId = lastId + 1;

      const newLayer: Layer = {
        id: newId,
        file: null,
        annotationsQc: null,
        annotationsPath: null,
        annotationsTooth: null,
        drawings: [],
        drawingHistory: [],
        responseQc: null,
        responsePath: null,
        responseTooth: null,
        canvasRef: React.createRef<any>(),
        containerRef: React.createRef<any>(),
        checkType: "qc",
      };

      setImageSizes((prev) => [...prev, { width: 0, height: 0 }]);
      setIsLoading((prev) => [...prev, false]);
      setSelectedLayer(newId);

      return [...prevLayers, newLayer];
    });
  };

  // const handleToggleFullscreen = (layer: Layer) => {
  //   setFullScreenLayer(fullScreenLayer ? null : layer);
  // };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (
      !isAnnotationEnabled ||
      (currentTool === "select" && !isTransforming)
    ) {
      handleShapeClick(e, fullScreenLayer || layers?.find((l) => l.id === selectedLayer)!);
      return;
    }

    const targetLayer = fullScreenLayer || layers?.find((l) => l.id === selectedLayer)!;
    const canvas = targetLayer.canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imageElement = targetLayer.containerRef.current?.querySelector("img");
    if (!imageElement) return;

    const displayedWidth = imageElement.getBoundingClientRect().width;
    const displayedHeight = imageElement.getBoundingClientRect().height;
    const layerIndex = layers?.findIndex((l) => l.id === targetLayer.id);
    const imageSize = imageSizes[layerIndex];
    if (!imageSize || !imageSize.width || !imageSize.height) return;

    const scaleX = imageSize.width / displayedWidth;
    const scaleY = imageSize.height / displayedHeight;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    if (currentTool === "move") {
      const shape:any = findShapeAtPoint(scaledX, scaledY, 1, 1, targetLayer);
      if (shape?.type === "drawing") {
        setIsTransforming(true);
        setSelectedShape(shape.drawingId);
        setTransformOrigin({ x: scaledX, y: scaledY });
        return;
      }
    }

    if (currentTool === "reshape") {
      const nearestPoint = findNearestPoint(scaledX, scaledY, targetLayer.drawings);
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
    }

    if (currentTool === "polygon") {
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
          setLayers((prev) =>
            prev.map((layer) =>
              layer.id === targetLayer.id
                ? {
                    ...layer,
                    drawings: [
                      ...layer.drawings,
                      {
                        type: "polygon",
                        points: currentPoints,
                        visible: true,
                        strokeColor: "#FF0000",
                        bgColor: "rgba(255, 0, 0, 0.2)",
                        showStroke: true,
                        showBackground: true,
                        label: "",
                        id: `drawing-${Date.now()}`,
                        transform: { scale: 1, rotation: 0, translate: { x: 0, y: 0 } },
                        showLabel: false,
                        // openDrawer:false
                      },
                    ],
                    drawingHistory: [...layer.drawingHistory, layer.drawings],
                  }
                : layer
            )
          );
          setIsPolygonDrawing(false);
          setCurrentPoints([]);
          setShowSelecting(true);
          setSelectionPosition({ x: scaledX, y: scaledY });
        } else {
          setCurrentPoints((prev) => [...prev, scaledX, scaledY]);
        }
      }
    } else if (currentTool === "point") {
      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === targetLayer.id
            ? {
                ...layer,
                drawings: [
                  ...layer.drawings,
                  {
                    type: "point",
                    points: [scaledX, scaledY],
                    visible: true,
                    strokeColor: "#FF0000",
                    bgColor: "rgba(255, 0, 0, 0.2)",
                    showStroke: true,
                    showBackground: true,
                    label: "",
                    id: `drawing-${Date.now()}`,
                    transform: { scale: 1, rotation: 0, translate: { x: 0, y: 0 } },
                    showLabel: false,
                    // openDrawer:false
                  },
                ],
                drawingHistory: [...layer.drawingHistory, layer.drawings],
              }
            : layer
        )
      );
      setShowSelecting(true);
      setSelectionPosition({ x: scaledX, y: scaledY });
    } else {
      setIsDrawing(true);
      setCurrentPoints([scaledX, scaledY]);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (
      !isAnnotationEnabled ||
      (!isDrawing && !isPolygonDrawing && !isTransforming && !isDraggingPoint)
    )
      return;

    const targetLayer = fullScreenLayer || layers?.find((l) => l.id === selectedLayer)!;
    const canvas = targetLayer.canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imageElement = targetLayer.containerRef.current?.querySelector("img");
    if (!imageElement) return;

    const displayedWidth = imageElement.getBoundingClientRect().width;
    const displayedHeight = imageElement.getBoundingClientRect().height;
    const layerIndex = layers?.findIndex((l) => l.id === targetLayer.id);
    const imageSize = imageSizes[layerIndex];
    if (!imageSize || !imageSize.width || !imageSize.height) return;

    const scaleX = imageSize.width / displayedWidth;
    const scaleY = imageSize.height / displayedHeight;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    if (isTransforming && selectedShape && currentTool === "move") {
      const drawing = targetLayer.drawings.find((d) => d.id === selectedShape);
      if (!drawing || !transformOrigin) return;

      const dx = scaledX - transformOrigin.x;
      const dy = scaledY - transformOrigin.y;

        setLayers((prev) =>
          prev.map((layer) =>
            layer.id === targetLayer.id
              ? {
                  ...layer,
                  drawings: layer.drawings.map((d) => {
                    if (d.id === selectedShape) {
                      const transform = d.transform || {
                        scale: 1,
                        rotation: 0,
                        translate: { x: 0, y: 0 },
                      };
                      return {
                        ...d,
                        points: d.points.map((point, index) =>
                          index % 2 === 0 ? point + dx : point + dy
                        ),
                        transform: {
                          ...transform,
                          translate: {
                            x: transform.translate.x + dx,
                            y: transform.translate.y + dy,
                          },
                        },
                      };
                    }
                    return d;
                  }),
                }
              : layer
          )
      );
      setTransformOrigin({ x: scaledX, y: scaledY });
      drawAnnotations(targetLayer.id);
      return;
    }

    if (
      isDraggingPoint &&
      selectedDrawingId !== null &&
      selectedPointIndex !== null
    ) {
      const offsetX = draggedPointOffset
        ? scaledX - draggedPointOffset.x
        : scaledX;
      const offsetY = draggedPointOffset
        ? scaledY - draggedPointOffset.y
        : scaledY;

      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === targetLayer.id
            ? {
                ...layer,
                drawings: layer.drawings.map((drawing) => {
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
                }),
              }
            : layer
        )
      );

      drawAnnotations(targetLayer.id);
      return;
    }

    if (currentTool !== "polygon") {
      setCurrentPoints((prev) => [...prev.slice(0, 2), scaledX, scaledY]);
    }

    drawAnnotations(targetLayer.id);
  };

    const endDrawing = () => {
    if (isDraggingPoint) {
      setIsDraggingPoint(false);
      setSelectedDrawingId(null);
      setSelectedPointIndex(null);
      setDraggedPointOffset(null);
      return;
    }
  
    if (!isDrawing && !isPolygonDrawing) return;
  
    const targetLayer = fullScreenLayer || layers?.find((l) => l.id === selectedLayer)!;
    const targetLayerId = targetLayer.id;
  
    // Validate if the drawing is valid
    if (isDrawing) {
      if (currentPoints.length < 4 || (currentPoints[0] === currentPoints[2] && currentPoints[1] === currentPoints[3])) {
        // If the drawing is invalid (e.g., just a click), reset the state and return
        setIsDrawing(false);
        setCurrentPoints([]);
        return;
      }
  
      const newDrawing: Drawing = {
        type: currentTool as "rectangle" | "line",
        points: currentPoints,
        visible: true,
        strokeColor: "#FF0000",
        bgColor: "rgba(255, 0, 0, 0.2)",
        showStroke: true,
        showBackground: true,
        label: "",
        id: `drawing-${Date.now()}`,
        transform: { scale: 1, rotation: 0, translate: { x: 0, y: 0 } },
        showLabel: false,
      };
  
      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === targetLayerId
            ? {
                ...layer,
                drawings: [...layer.drawings, newDrawing],
                drawingHistory: [...layer.drawingHistory, layer.drawings],
              }
            : layer
        )
      );
      setIsDrawing(false);
      setCurrentPoints([]);
      setShowSelecting(true);
      setSelectionPosition({ x: currentPoints[0], y: currentPoints[1] });
    }
  
    drawAnnotations(targetLayerId);
  };

  const handleDoubleClick = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPolygonDrawing || currentTool !== "polygon") return;

    const targetLayer = fullScreenLayer || layers?.find((l) => l.id === selectedLayer)!;
    const targetLayerId = targetLayer.id;

    if (currentPoints.length >= 6) {
      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === targetLayerId
            ? {
                ...layer,
                drawings: [
                  ...layer.drawings,
                  {
                    type: "polygon",
                    points: currentPoints,
                    visible: true,
                    strokeColor: "#FF0000",
                    bgColor: "rgba(255, 0, 0, 0.2)",
                    showStroke: true,
                    showBackground: true,
                    label: "",
                    id: `drawing-${Date.now()}`,
                    transform: { scale: 1, rotation: 0, translate: { x: 0, y: 0 } },
                    showLabel: false,
                  },
                ],
                drawingHistory: [...layer.drawingHistory, layer.drawings],
              }
            : layer
        )
      );
      setShowSelecting(true);
      setSelectionPosition({ x: currentPoints[0], y: currentPoints[1] });
    }

    setIsPolygonDrawing(false);
    setCurrentPoints([]);
    drawAnnotations(targetLayerId);
  };

  // const handleSelectionSubmit = (
  //   toothNumber: string,
  //   pathology: string,
  //   customPathology?: string
  // ) => {
  //   setLayers((prev) =>
  //     prev.map((layer) =>
  //       layer.id === (fullScreenLayer ? fullScreenLayer.id : selectedLayer)
  //         ? {
  //             ...layer,
  //             drawings: layer.drawings.map((drawing, index) => {
  //               if (index !== layer.drawings.length - 1) return drawing;
  //               const label =
  //                 pathology === "Other" && customPathology
  //                   ? `${toothNumber} ${customPathology}`
  //                   : `${toothNumber} ${pathology}`;
  //               return {
  //                 ...drawing,
  //                 label,
  //                 toothNumber,
  //                 pathology,
  //                 customPathology,
  //               };
  //             }),
  //           }
  //         : layer
  //     )
  //   );
  //   setShowSelecting(false);
  // };

  const handleDownloadWithAnnotations = () => {
    const layer = fullScreenLayer || layers?.find((l) => l.id === selectedLayer)!;
    if (!layer?.file) {
      toast.error("No image to download");
      return;
    }

    const layerIndex = layers?.findIndex((l) => l.id === layer.id);
    const imageSize = imageSizes[layerIndex];
    if (!imageSize || !imageSize.width || !imageSize.height) return;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCanvas.width = imageSize.width;
    tempCanvas.height = imageSize.height;

    const img = new Image();
    img.onload = () => {
      tempCtx.drawImage(img, 0, 0, imageSize.width, imageSize.height);

      if (isAnnotationEnabled) {
        const annotateList = layer.checkType === "qc" ? layer?.annotationsQc : layer.checkType === "path" ? layer?.annotationsPath : layer?.annotationsTooth;
        annotateList?.forEach((annotation) => {
          annotation.roi_xyxy.forEach((coord) => {
            if (!coord.visible) return;

            if ((layer.checkType === "path" || layer.checkType === "tooth") && coord.poly && coord.poly.length > 0) {
              tempCtx.beginPath();
              tempCtx.fillStyle = coord.showBackground ? coord.bgColor : "transparent";
              tempCtx.strokeStyle = coord.showStroke ? coord.strokeColor : "transparent";
              tempCtx.moveTo(coord.poly[0][0], coord.poly[0][1]);
              for (let i = 1; i < coord.poly.length; i++) {
                tempCtx.lineTo(coord.poly[i][0], coord.poly[i][1]);
              }
              tempCtx.closePath();
              if (coord.showBackground) tempCtx.fill();
              if (coord.showStroke) tempCtx.stroke();

              if (coord.showLabel) {
                const label = `${annotation.class}`;
                tempCtx.font = "12px Poppins";
                const textMetrics = tempCtx.measureText(label);
                tempCtx.fillStyle =
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(0, 0, 0, 0.7)";
                tempCtx.fillRect(
                  coord.poly[0][0],
                  coord.poly[0][1] - 20,
                  textMetrics.width + 10,
                  20
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
              if (coord.showBackground && coord.bgColor) {
                tempCtx.fillStyle = coord.bgColor;
                tempCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
              }

              if (coord.showStroke && coord.strokeColor) {
                tempCtx.strokeStyle = coord.strokeColor;
                tempCtx.lineWidth = 2;
                tempCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
              }

              if (coord.showLabel) {
                const label = layer.checkType === "qc" ? `${annotation.class} ${coord.label}` : `${annotation.class}`;
                tempCtx.font = "12px Poppins";
                const textMetrics = tempCtx.measureText(label);
                tempCtx.fillStyle =
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(0, 0, 0, 0.7)";
                tempCtx.fillRect(x1, y1 - 20, textMetrics.width + 10, 20);
                tempCtx.fillStyle = "#FFFFFF";
                tempCtx.fillText(label, x1 + 5, y1 - 5);
              }
            }
          });
        });

        layer.drawings.forEach((drawing) => drawShape(tempCtx, drawing, 1, 1));
      }

      tempCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `annotated_${layer?.file?.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success("Download completed");
        }
      }, "image/png");
    };

    img.src = URL.createObjectURL(layer.file);
  };

  useEffect(() => {
    const canvas = fullScreenLayer
      ? fullScreenLayer.canvasRef.current
      : layers?.find((l) => l.id === selectedLayer)?.canvasRef?.current;
    if (!canvas) return;

    canvas.style.cursor = currentTool === "select"
    ? "default"
    : currentTool === "move" || currentTool === "reshape"
    ? "grab"
    : "crosshair";
  }, [currentTool, layers, selectedLayer, fullScreenLayer]);

  useEffect(() => {
    const layer = layers?.find((l) => l.id === selectedLayer);
    if (layer?.file && !layer.responseQc && !layer.responsePath && !layer.responseTooth) {
      handleUpload();
    }
  }, [layers, selectedLayer]);

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

  const bgColor = theme === "dark" ? "bg-zinc-900" : "bg-gray-100";
  const borderColorForLoader =
    theme === "dark" ? "border-white" : "border-black";
  const textColor = theme === "dark" ? "text-zinc-100" : "text-gray-900";
  const iconColor = theme === "dark" ? "text-zinc-100" : "text-gray-500";
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
                        {checkTypeOptions.find(option => option.value === layers?.find((l) => l.id === selectedLayer)?.checkType)?.label || "QC"}
                      </span>
                      <ChevronDown size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {checkTypeOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => {
                          setLayers((prev) =>
                            prev.map((layer) =>
                              layer.id === selectedLayer
                                ? { ...layer, checkType: option.value as "qc" | "path" | "tooth" }
                                : layer
                            )
                          );
                        }}
                        className={`cursor-pointer ${
                          layers?.find((l) => l.id === selectedLayer)?.checkType === option.value ? "bg-accent" : ""
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
        </div>
      </div>
      <div className="min-[400px]:hidden flex justify-center">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`p-2 text-xs ${buttonHoverColor} rounded-full flex items-center gap-1`}
                  >
                    Switch to {checkTypeOptions.find(option => option.value === layers?.find((l) => l.id === selectedLayer)?.checkType)?.label || "QC"}
                    <ChevronDown size={12} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-40">
                  {checkTypeOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => {
                        setLayers((prev) =>
                          prev.map((layer) =>
                            layer.id === selectedLayer
                              ? { ...layer, checkType: option.value as "qc" | "path" | "tooth" }
                              : layer
                          )
                        );
                      }}
                      className={`cursor-pointer ${
                        layers?.find((l) => l.id === selectedLayer)?.checkType === option.value ? "bg-accent" : ""
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
          onClick={() => handleRemoveImage(selectedLayer)}
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
                {isAnnotationEnabled ? "Disable" : "Enable"} Annotation
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`p-2 rounded-full ${buttonHoverColor}`}
                  onClick={addLayer}
                >
                  <Layers size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="px-3 py-1.5 text-sm font-medium shadow-lg"
              >
                Add Layer
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div
          className="flex justify-center overflow-y-scroll scrollbar-hide relative overflow-hidden"
          style={{ width: "calc(100% - 4.5rem)" }}
        >
          {isLoading[selectedLayer] && (
            <div
              className={`absolute z-40 inset-0 flex items-center justify-center ${bgColor} bg-opacity-50`}
            >
              <div
                className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${borderColorForLoader}`}
              ></div>
            </div>
          )}
          {fullScreenLayer ? (
            <div className="w-full grid grid-cols-1">
              <div key={fullScreenLayer.id} className="relative">
                {!fullScreenLayer.file ? (
                  <div
                    {...getRootProps({
                      onClick: () => setSelectedLayer(fullScreenLayer.id),
                    })}
                    className={`w-full h-full min-h-[300px] flex flex-col justify-center items-center border ${
                      theme === "dark" ? "border-zinc-700" : "border-gray-300"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <MdOutlineCloudUpload size={64} className={iconColor} />
                    <p className={`${iconColor} text-sm text-center px-4`}>
                      Click or drag image to upload
                    </p>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center h-full"
                    ref={fullScreenLayer.containerRef}
                  >
                    <div className="absolute top-0 right-0 z-20 p-2 group">
                      <p
                        className={`${iconColor} cursor-pointer`}
                        onClick={() => setFullScreenLayer(null)}
                      >
                        <Minimize strokeWidth={1.2} size={"20px"} />
                      </p>
                    </div>
                    <div className="relative inline-block">
                      <img
                        src={URL.createObjectURL(fullScreenLayer.file)}
                        alt="Uploaded Scan"
                        className="max-h-[90vh] max-w-full object-contain"
                        style={{ width: "auto", height: "auto" }}
                      />
                      <canvas
                        ref={fullScreenLayer.canvasRef}
                        className="absolute top-0 left-0"
                        style={{ width: "100%", height: "100%" }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={endDrawing}
                        onDoubleClick={handleDoubleClick}
                        onMouseLeave={() => {
                          setIsDrawing(false);
                          drawAnnotations(fullScreenLayer.id);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`w-full grid ${
                layers?.length >= 3
                  ? "xl:grid-cols-3 sm:grid-cols-2 grid-cols-1"
                  : layers?.length === 2
                  ? "xl:grid-cols-2 sm:grid-cols-2 grid-cols-1"
                  : "grid-cols-1"
              }`}
            >
              {layers?.map((layer) => (
                <div key={layer.id} className="relative">
                  {layers?.length > 1 && (
                    <LayerActionMenu
                      layer={layer}
                      theme={theme}
                      handleDeleteLayer={handleDeleteLayer}
                    />
                  )}
                  {!layer.file ? (
                    <div
                      {...getRootProps({
                        onClick: () => setSelectedLayer(layer.id),
                      })}
                      className={`w-full h-full min-h-[300px] flex flex-col justify-center items-center border ${
                        theme === "dark" ? "border-zinc-700" : "border-gray-200"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <MdOutlineCloudUpload size={64} className={iconColor} />
                      <p className={`${iconColor} text-sm text-center px-4`}>
                        Click or drag image to upload
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-center h-full border ${
                        layer.id !== selectedLayer
                          ? theme === "dark"
                            ? "border-zinc-700"
                            : "border-gray-200"
                          : "border-2 border-blue-400"
                      }`}
                      ref={layer.containerRef}
                      onClick={() => setSelectedLayer(layer.id)}
                    >
                      <LayerOptions
                        layer={layer}
                        theme={theme}
                        setFullScreenLayer={setFullScreenLayer}
                        handleDeleteLayer={handleDeleteLayer}
                        handleDeleteLayerImg={() => handleRemoveImage(layer.id)}
                        setLayers={setLayers}
                      />
                      <div className="relative inline-block">
                        <img
                          src={URL.createObjectURL(layer.file)}
                          alt="Uploaded Scan"
                          className="max-h-[90vh] max-w-full object-contain"
                          style={{ width: "auto", height: "auto" }}
                        />
                        <canvas
                          ref={layer.canvasRef}
                          className="absolute top-0 left-0"
                          style={{ width: "100%", height: "100%" }}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={endDrawing}
                          onDoubleClick={handleDoubleClick}
                          onMouseLeave={() => {
                            setIsDrawing(false);
                            drawAnnotations(layer.id);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          className={`transition-all duration-300 z-30 fixed right-0 h-svh ease-in-out ${
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
            <div className="p-4 overflow-y-scroll scrollbar-hide h-svh">
              <h3 className="text-lg font-semibold pb-1">Annotations</h3>
              <Tabs defaultValue="OPG" className="w-full">
                <TabsList
                  className={`grid w-full grid-cols-2 border ${
                    theme === "dark" ? "border-zinc-600" : "border-gray-200"
                  }`}
                >
                  <TabsTrigger value="OPG">OPG</TabsTrigger>
                  <TabsTrigger value="MARKINGS">MARKINGS</TabsTrigger>
                </TabsList>
                <TabsContent value="OPG" className="mt-2 overflow-y-scroll scrollbar-hide mb-2">
                  {layers.map((layer) => (
                    <div key={layer.id}>
                      <p className="py-2">Layer {layer.id + 1}</p>
                      <RenderOPGAnnotationsList
                        annotations={layer.checkType=="qc"?layer?.annotationsQc:layer.checkType=="path"?layer?.annotationsPath:layer?.annotationsTooth}
                        theme={theme}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        setAnnotations={setLayers}
                        textColor={textColor}
                        secondaryTextColor={secondaryTextColor}
                        viewer={"layer"}
                        checkType={layer.checkType}
                      />
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="MARKINGS" className="mt-2">
                  {layers.map((layer) => (
                    <div key={layer.id}>
                      <p className="py-2">Layer {layer.id + 1}</p>
                      <RenderCustomAnnotationsList
                        drawings={layer?.drawings}
                        theme={theme}
                        // setDrawings={(drawings:any) =>
                        //   setLayers((prev) =>
                        //     prev.map((l) =>
                        //       l.id === layer.id ? { ...l, drawings } : l
                        //     )
                        //   )
                        // }
                        setDrawings={setLayers}
                        textColor={textColor}
                        secondaryTextColor={secondaryTextColor}
                        viewer={"layer"}
                      />
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}