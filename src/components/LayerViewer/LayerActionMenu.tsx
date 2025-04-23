import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EllipsisVertical, Trash2 } from "lucide-react";
import React from "react";

const LayerActionMenu: React.FC<any> = ({
  layer,
  theme,
  handleDeleteLayer,
}) => {
  const iconColor = theme === "dark" ? "text-zinc-100" : "text-gray-500";
  return (
    <div className="absolute top-0 right-0 z-20 p-2 group">
      {/* Trigger icon */}
      <p className={`${iconColor} cursor-pointer`}>
        <EllipsisVertical strokeWidth={1.2} size={"20px"} />
      </p>

      {/* Hover menu */}
      <div className="hidden group-hover:flex flex-col absolute  top-8 right-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg z-50 -mt-1 w-[150px]">
        <TooltipProvider>
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
            <TooltipContent>Delete Layer</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default LayerActionMenu;
