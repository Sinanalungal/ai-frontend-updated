import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Highlighter,
  Play,
  Fullscreen,
  Minimize,
  Layers,
} from "lucide-react";
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
import { ToolBar } from "./Toolbar";

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
    openDrawer: boolean;
    showLabel: boolean;
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
  label?: string;
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
  annotations: Annotation[] | null;
  drawings: Drawing[];
  drawingHistory: Drawing[][];
  response: UploadResponse | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function LayerViewer() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<number>(0);
  const [checkType, setCheckType] = useState<"qc" | "path">("qc");
  const [isAnnotationEnabled, setIsAnnotationEnabled] = useState(true);
  const [currentTool, setCurrentTool] = useState<
    | "select"
    | "move"
    | "reshape"
    | "rectangle"
    | "line"
    | "point"
    | "polygon"
    | "measure"
  >("select");
  const [isLoading, setIsLoading] = useState<boolean[]>([false]);
  const [imageSizes, setImageSizes] = useState<
    { width: number; height: number }[]
  >([{ width: 0, height: 0 }]);

  const [layers, setLayers] = useState<Layer[]>([
    {
      id: 0,
      file: null,
      annotations: null,
      drawings: [],
      drawingHistory: [],
      response: null,
      canvasRef: React.createRef<HTMLCanvasElement>(),
      containerRef: React.createRef<HTMLDivElement>(),
    },
  ]);

  const [fullScreenLayer, setFullScreenLayer] = useState<Layer | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [isPolygonDrawing, setIsPolygonDrawing] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleRemoveImage = (layerId: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              file: null,
              annotations: null,
              drawings: [],
              drawingHistory: [],
              response: null,
            }
          : layer
      )
    );
    setImageSizes((prev) =>
      prev.map((size, index) =>
        layers[index].id === layerId ? { width: 0, height: 0 } : size
      )
    );
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
  };

  const handleUpload = async () => {
    const layer = layers[selectedLayer];
    if (!layer?.file) return;

    setIsLoading((prev) => {
      const newLoading = [...prev];
      newLoading[selectedLayer] = true;
      return newLoading;
    });

    const formData = new FormData();
    formData.append("file", layer.file);
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
      processApiResponse(responseData);
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

  const processApiResponse = (responseData: UploadResponse) => {
    const classMap = new Map<string, Annotation>();

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
        strokeColor: classColors[className]
          ? classColors[className][1]
          : "rgb(255,0,0)",
        bgColor: classColors[className]
          ? classColors[className][0]
          : "rgba(255, 0, 0, 0.5)",
        showStroke: true,
        showBackground: checkType === "path",
        openDrawer: false,
        showLabel: false,
      });
    });

    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === selectedLayer
          ? {
              ...layer,
              annotations: Array.from(classMap.values()),
              response: responseData,
            }
          : layer
      )
    );
  };

    useEffect(() => {
    console.log("Layers:", layers);
    console.log("Image Sizes:", imageSizes);
  }, [layers, imageSizes]);

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
          // Update imageSizes safely
          setImageSizes((prev) =>
            prev.map((size, index) => {
              const layer = layers[index];
              if (!layer) return size; // Fallback for undefined layers
  
              return layer.id === selectedLayer
                ? { width: img.width, height: img.height }
                : size;
            })
          );
  
          // Update layers with the new file
          setLayers((prev) =>
            prev.map((layer) =>
              layer.id === selectedLayer
                ? {
                    ...layer,
                    file,
                    annotations: null,
                    drawings: [],
                    drawingHistory: [],
                    response: null,
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

  const drawAnnotations = useCallback(
    (layerId?: number) => {
      const layersToDraw =
        layerId !== undefined
          ? [layers.find((l) => l.id === layerId)].filter(
              (l): l is Layer => l !== undefined
            )
          : layers;

      layersToDraw.forEach((layer) => {
        const canvas = layer.canvasRef.current;
        const container = layer.containerRef.current;
        const layerIndex = layers.findIndex((l) => l.id === layer.id);
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

        // Set canvas dimensions with device pixel ratio for crisp rendering
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

        layer.annotations?.forEach((annotation) => {
          annotation.roi_xyxy.forEach((coord) => {
            if (!coord.visible) return;

            if (checkType === "path" && coord.poly && coord.poly.length > 0) {
              ctx.beginPath();
              ctx.fillStyle =
                coord.showBackground && coord.bgColor
                  ? coord.bgColor
                  : "transparent";
              ctx.strokeStyle =
                coord.showStroke && coord.strokeColor
                  ? coord.strokeColor
                  : "transparent";
              ctx.lineWidth = 0.8;

              ctx.moveTo(coord.poly[0][0] * scaleX, coord.poly[0][1] * scaleY);
              for (let i = 1; i < coord.poly.length; i++) {
                ctx.lineTo(coord.poly[i][0] * scaleX, coord.poly[i][1] * scaleY);
              }
              ctx.closePath();
              if (coord.showBackground) ctx.fill();
              if (coord.showStroke) ctx.stroke();

              if (coord.showLabel) {
                const label = `${coord.label}. ${annotation.class}`.trim();
                if (label) {
                  ctx.font = "12px Poppins";
                  const textMetrics = ctx.measureText(label);
                  ctx.fillStyle =
                    theme === "dark"
                      ? "rgba(0, 0, 0, 0.7)"
                      : "rgba(0, 0, 0, 0.7)";
                  ctx.fillRect(
                    coord.poly[0][0] * scaleX,
                    coord.poly[0][1] * scaleY - 20,
                    textMetrics.width + 10,
                    20
                  );
                  ctx.fillStyle = "#FFFFFF";
                  ctx.fillText(
                    label,
                    coord.poly[0][0] * scaleX + 5,
                    coord.poly[0][1] * scaleY - 5
                  );
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
                const label = `${coord.label} ${annotation.class}`.trim();
                if (label) {
                  ctx.font = "12px Poppins";
                  const textMetrics = ctx.measureText(label);
                  ctx.fillStyle =
                    theme === "dark"
                      ? "rgba(0, 0, 0, 0.7)"
                      : "rgba(0, 0, 0, 0.7)";
                  ctx.fillRect(
                    scaledX1,
                    scaledY1 - 20,
                    textMetrics.width + 10,
                    20
                  );
                  ctx.fillStyle = "#FFFFFF";
                  ctx.fillText(label, scaledX1 + 5, scaledY1 - 5);
                }
              }
            }
          });
        });

        layer.drawings.forEach((drawing) =>
          drawShape(ctx, drawing, scaleX, scaleY)
        );

        // Draw current drawing preview for the active layer
        if (
          (isDrawing || isPolygonDrawing) &&
          currentPoints.length >= 2 &&
          layer.id === (fullScreenLayer ? fullScreenLayer.id : selectedLayer)
        ) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
          ctx.lineWidth = 1;

          if (currentTool === "rectangle") {
            ctx.strokeRect(
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
              ctx.lineTo(currentPoints[i] * scaleX, currentPoints[i + 1] * scaleY);
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
      checkType,
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
        drawAnnotations(); // Redraw all layers
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
    // Redraw all layers when imageSizes, layers, or fullScreenLayer change
    drawAnnotations();
  }, [imageSizes, layers, fullScreenLayer, drawAnnotations]);

    const addLayer = () => {
    setLayers((prevLayers) => {
      if (prevLayers.length >= 6) {
        toast.error("Maximum of 6 layers allowed");
        return prevLayers;
      }
  
      const lastId =
        prevLayers.length > 0 ? prevLayers[prevLayers.length - 1].id : 0;
      const newId = lastId + 1;
  
      const newLayer: Layer = {
        id: newId,
        file: null,
        annotations: null,
        drawings: [],
        drawingHistory: [],
        response: null,
        canvasRef: React.createRef<HTMLCanvasElement>(),
        containerRef: React.createRef<HTMLDivElement>(),
      };
  
      // Add a new entry to imageSizes for the new layer
      setImageSizes((prev) => [...prev, { width: 0, height: 0 }]);
  
      return [...prevLayers, newLayer];
    });
  };
  
  const handleDeleteLayer = (id: number) => {
    if (layers.length === 1) {
      toast.error("Cannot delete the last layer");
      return;
    }
  
    setLayers((prev) => prev.filter((layer) => layer.id !== id));
  
    // Remove the corresponding entry from imageSizes
    setImageSizes((prev) =>
      prev.filter((_, index) => layers[index].id !== id)
    );
  
    if (selectedLayer === id) {
      setSelectedLayer(layers[0].id);
    }
    if (fullScreenLayer?.id === id) {
      setFullScreenLayer(null);
    }
  };

  const handleToggleFullscreen = (layer: Layer) => {
    setFullScreenLayer(fullScreenLayer ? null : layer);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (
      !isAnnotationEnabled ||
      !["rectangle", "line", "point", "polygon"].includes(currentTool)
    )
      return;

    const targetLayer = fullScreenLayer || layers[selectedLayer];
    const canvas = targetLayer.canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imageElement = targetLayer.containerRef.current?.querySelector("img");
    if (!imageElement) return;

    const displayedWidth = imageElement.getBoundingClientRect().width;
    const displayedHeight = imageElement.getBoundingClientRect().height;
    const layerIndex = layers.findIndex((l) => l.id === targetLayer.id);
    const imageSize = imageSizes[layerIndex];
    if (!imageSize || !imageSize.width || !imageSize.height) return;

    const scaleX = imageSize.width / displayedWidth;
    const scaleY = imageSize.height / displayedHeight;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    if (currentTool === "polygon") {
      if (!isPolygonDrawing) {
        setIsPolygonDrawing(true);
        setCurrentPoints([scaledX, scaledY]);
      } else {
        setCurrentPoints((prev) => [...prev, scaledX, scaledY]);
      }
    } else if (currentTool === "point") {
      const newDrawing: Drawing = {
        type: "point",
        points: [scaledX, scaledY],
        visible: true,
        strokeColor: "rgb(255,0,0)",
        bgColor: "rgba(255,0,0,0.2)",
        showStroke: true,
        showBackground: true,
        showLabel: false,
      };

      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === targetLayer.id
            ? {
                ...layer,
                drawings: [...layer.drawings, newDrawing],
                drawingHistory: [...layer.drawingHistory, layer.drawings],
              }
            : layer
        )
      );
    } else {
      setIsDrawing(true);
      setCurrentPoints([scaledX, scaledY]);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (
      !isAnnotationEnabled ||
      (!isDrawing && !isPolygonDrawing) ||
      !["rectangle", "line", "polygon"].includes(currentTool)
    )
      return;

    const targetLayer = fullScreenLayer || layers[selectedLayer];
    const canvas = targetLayer.canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imageElement = targetLayer.containerRef.current?.querySelector("img");
    if (!imageElement) return;

    const displayedWidth = imageElement.getBoundingClientRect().width;
    const displayedHeight = imageElement.getBoundingClientRect().height;
    const layerIndex = layers.findIndex((l) => l.id === targetLayer.id);
    const imageSize = imageSizes[layerIndex];
    if (!imageSize || !imageSize.width || !imageSize.height) return;

    const scaleX = imageSize.width / displayedWidth;
    const scaleY = imageSize.height / displayedHeight;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    if (currentTool !== "polygon") {
      setCurrentPoints((prev) => [...prev.slice(0, 2), scaledX, scaledY]);
    }

    drawAnnotations(targetLayer.id);
  };

  const endDrawing = () => {
    if (!isDrawing && !isPolygonDrawing) return;

    const targetLayer = fullScreenLayer || layers[selectedLayer];
    const targetLayerId = targetLayer.id;

    if (currentTool === "polygon" && isPolygonDrawing) {
      // Polygon drawing is completed via double-click
      return;
    } else if (isDrawing) {
      const newDrawing: Drawing = {
        type: currentTool as "rectangle" | "line",
        points: currentPoints,
        visible: true,
        strokeColor: "rgb(255,0,0)",
        bgColor: "rgba(255,0,0,0.2)",
        showStroke: true,
        showBackground: true,
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
    }

    drawAnnotations(targetLayerId);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPolygonDrawing || currentTool !== "polygon") return;

    const targetLayer = fullScreenLayer || layers[selectedLayer];
    const targetLayerId = targetLayer.id;

    if (currentPoints.length >= 6) {
      // Ensure at least 3 points for a polygon
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
                    strokeColor: "rgb(255,0,0)",
                    bgColor: "rgba(255,0,0,0.2)",
                    showStroke: true,
                    showBackground: true,
                    showLabel: false,
                  },
                ],
                drawingHistory: [...layer.drawingHistory, layer.drawings],
              }
            : layer
        )
      );
    }

    setIsPolygonDrawing(false);
    setCurrentPoints([]);
    drawAnnotations(targetLayerId);
  };

  const handleDownloadWithAnnotations = () => {
    const layer = fullScreenLayer || layers[selectedLayer];
    if (!layer?.file) {
      toast.error("No image to download");
      return;
    }

    const layerIndex = layers.findIndex((l) => l.id === layer.id);
    const imageSize = imageSizes[layerIndex];
    if (!imageSize || !imageSize.width || !imageSize.height) return;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCanvas.width = imageSize.width;
    tempCanvas.height = imageSize.height;

    const img = new Image();
    img.onload = () => {
      const displayedImage = layer.containerRef?.current?.querySelector("img");
      if (!displayedImage) return;

      const displayedWidth = displayedImage.getBoundingClientRect().width;
      const displayedHeight = displayedImage.getBoundingClientRect().height;
      const scaleX = imageSize.width / displayedWidth;
      const scaleY = imageSize.height / displayedHeight;

      tempCtx.drawImage(img, 0, 0, imageSize.width, imageSize.height);

      if (isAnnotationEnabled) {
        layer.annotations?.forEach((annotation) => {
          annotation.roi_xyxy.forEach((coord) => {
            if (!coord.visible) return;

            if (checkType === "path" && coord.poly && coord.poly.length > 0) {
              tempCtx.beginPath();
              tempCtx.fillStyle =
                coord.showBackground && coord.bgColor
                  ? coord.bgColor
                  : "transparent";
              tempCtx.strokeStyle =
                coord.showStroke && coord.strokeColor
                  ? coord.strokeColor
                  : "transparent";
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
                const label = `${annotation.class} ${coord.label}`;
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

        layer.drawings.forEach((drawing) =>
          drawShape(tempCtx, drawing, 1, 1) // Use 1:1 scale for download
        );
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
      : layers[selectedLayer]?.canvasRef?.current;
    if (!canvas) return;

    canvas.style.cursor = currentTool === "select" ? "default" : "crosshair";
  }, [currentTool, layers, selectedLayer, fullScreenLayer]);

  useEffect(() => {
    const layer = layers[selectedLayer];
    if (layer?.file && !layer.response) {
      handleUpload();
    }
  }, [layers, selectedLayer, checkType]);

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
                <button
                  className={`p-2 max-[400px]:hidden text-xs ${buttonHoverColor} rounded-full flex items-center gap-1`}
                  onClick={() =>
                    setCheckType(checkType === "qc" ? "path" : "qc")
                  }
                >
                  <span className="max-sm:hidden">Switch to</span>
                  <span>{checkType === "qc" ? "Pathology" : "QC"}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="px-3 py-1.5 text-xs font-medium shadow-lg"
              >
                Switch to {checkType === "qc" ? "Pathology" : "Quality"} Check
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
              <button
                className={`p-2 text-xs ${buttonHoverColor} rounded-full flex items-center gap-1`}
                onClick={() => setCheckType(checkType === "qc" ? "path" : "qc")}
              >
                Switch to {checkType === "qc" ? "Pathology" : "QC"}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="px-3 py-1.5 text-xs font-medium shadow-lg"
            >
              Switch to {checkType === "qc" ? "Pathology" : "Quality"} Check
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ToolBar
        theme={theme}
        barBgColor={barBgColor}
        borderColor={borderColor}
        handleUndo={handleUndo}
        handleDownloadWithAnnotations={handleDownloadWithAnnotations}
        setCurrentTool={setCurrentTool}
      />
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
                    <LayerOptions
                      layer={fullScreenLayer}
                      theme={theme}
                      setFullScreenLayer={setFullScreenLayer}
                      handleDeleteLayer={handleDeleteLayer}
                      handleDeleteLayerImg={() =>
                        handleRemoveImage(fullScreenLayer.id)
                      }
                    />
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
                layers.length >= 3
                  ? "xl:grid-cols-3 sm:grid-cols-2 grid-cols-1"
                  : layers.length === 2
                  ? "xl:grid-cols-2 sm:grid-cols-2 grid-cols-1"
                  : "grid-cols-1"
              }`}
            >
              {layers.map((layer) => (
                <div key={layer.id} className="relative">
                  {layers.length > 1 && (
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
                        theme === "dark" ? "border-zinc-700" : "border-gray-200"
                      }`}
                      ref={layer.containerRef}
                    >
                      <LayerOptions
                        layer={layer}
                        theme={theme}
                        setFullScreenLayer={setFullScreenLayer}
                        handleDeleteLayer={handleDeleteLayer}
                        handleDeleteLayerImg={() => handleRemoveImage(layer.id)}
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
              <ChevronRight size={18} />)
            : (
              <ChevronLeft size={18} />
            )}
          </button>
          {infoPanelOpen && (
            <div className="p-4">
              <h3 className="text-lg font-semibold">Annotations</h3>
              <p className="text-sm">List of annotations will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}