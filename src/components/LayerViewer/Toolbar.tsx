import React from "react";
import {
  Undo,
  MousePointer,
  Move,
  SquarePen,
  Square,
  Minus,
  Dot,
  Ruler,
  Download,
} from "lucide-react";
import { BsBoundingBoxCircles } from "react-icons/bs";
import { ToolButton } from "../Viewer/ToolButton";

interface ToolBarProps {
  theme: string;
  barBgColor: string;
  borderColor: string;
  handleUndo: () => void;
  handleDownloadWithAnnotations: () => void;
  setCurrentTool: any;
}

export const ToolBar: React.FC<ToolBarProps> = ({
  theme,
  barBgColor,
  borderColor,
  handleUndo,
  handleDownloadWithAnnotations,
  setCurrentTool,
}) => {
  const tools = [
    { icon: <Undo size={16} />, label: "Undo", action: handleUndo },
    { icon: <MousePointer size={16} />, label: "Select", action: () => setCurrentTool("select") },
    { icon: <Move size={16} />, label: "Move", action: () => setCurrentTool("move") },
    { icon: <SquarePen size={16} />, label: "Reshape", action: () => setCurrentTool("reshape") },
    { icon: <Square size={16} />, label: "Rectangle", action: () => setCurrentTool("rectangle") },
    { icon: <Minus size={16} />, label: "Line", action: () => setCurrentTool("line") },
    { icon: <Dot size={16} />, label: "Point", action: () => setCurrentTool("point") },
    { icon: <BsBoundingBoxCircles size={16} />, label: "Polygon", action: () => setCurrentTool("polygon") },
    { icon: <Ruler size={16} />, label: "Measure", action: () => setCurrentTool("measure") },
    { separator: true },
    { icon: <Download size={16} />, label: "Export", action: handleDownloadWithAnnotations },
  ];

  return (
    <div className={`flex items-center p-1 gap-1 ${barBgColor} ${borderColor} border-b overflow-x-auto scrollbar-hide`}>
      {tools.map((tool, index) =>
        tool.separator ? (
          <div key={index} className={`h-6 border-l ${borderColor} mx-1`} />
        ) : (
          <ToolButton
            key={tool.label}
            icon={tool.icon}
            label={tool.label}
            theme={theme}
            onClick={tool.action}
          />
        )
      )}
    </div>
  );
};
