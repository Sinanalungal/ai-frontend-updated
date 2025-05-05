import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EllipsisVertical, Fullscreen, Trash2, ImageMinus } from "lucide-react";
import React from "react";
import { HiOutlineSwitchHorizontal } from "react-icons/hi";


const LayerOptions: React.FC<any> = ({
  layer,
  theme,
  setFullScreenLayer,
  handleDeleteLayer,
  toggleLayerCheckType,
  handleDeleteLayerImg,
}) => {
  // console.log(layer,"theeeese layer");
  
//   const textColor = theme === "dark" ? "text-gray-900" : "text-gray-900";
  const iconColor = theme === "dark" ? "text-zinc-100" : "text-gray-500";

  return (
    <div className="absolute top-0 right-0 z-20 p-2 group">
      {/* Trigger icon */}
      <p className={`${iconColor} cursor-pointer`}>
        <EllipsisVertical strokeWidth={1.2} size={"20px"} />
      </p>

      {/* Hover menu */}
      <div className="hidden group-hover:flex flex-col absolute text-xs top-8 -mt-1 right-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg z-50 w-[150px]">
        <TooltipProvider>
          {/* Fullscreen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-900`}
                onClick={() => setFullScreenLayer(layer)}
              >
                <Fullscreen strokeWidth={1.2} size={16} />
                <span>Fullscreen</span>
              </button>
            </TooltipTrigger>
            {/* <TooltipContent>Set Fullscreen</TooltipContent> */}
          </Tooltip>
          <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-900"
             onClick={() => toggleLayerCheckType(layer.id)}>
              <HiOutlineSwitchHorizontal strokeWidth={1.2} size={16} />
              <span>Switch to {layer.checkType === "qc" ? "Path" : "QC"}</span>
            </button>
          </TooltipTrigger>
        </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-zinc-800  text-gray-900`}
                onClick={handleDeleteLayerImg}
              >
                <ImageMinus strokeWidth={1.2} size={15} />
                <span>Remove Image</span>
              </button>
            </TooltipTrigger>
            {/* <TooltipContent>Remove Image</TooltipContent> */}
          </Tooltip>

          {/* Delete */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-500 hover:bg-red-100 dark:hover:bg-red-900"
                onClick={() => handleDeleteLayer(layer.id)}
              >
                <Trash2 strokeWidth={1.2} size={16} />
                <span>Delete</span>
              </button>
            </TooltipTrigger>
            {/* <TooltipContent>Delete Layer</TooltipContent> */}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default LayerOptions;
