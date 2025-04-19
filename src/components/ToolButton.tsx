import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ToolButton({ icon, label, theme, onClick }: any) {
  const buttonHoverColor =
    theme === "dark" ? "hover:bg-zinc-700" : "hover:bg-gray-200";
  const buttonTextColor = theme === "dark" ? "text-zinc-300" : "text-gray-600";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`flex flex-col items-center justify-center py-1 px-2 ${buttonHoverColor} rounded ${buttonTextColor} hover:text-white transition-colors duration-150`}
            onClick={onClick}
          >
            <div>{icon}</div>
            <span className="text-xs mt-1">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          className={`px-3 py-1.5 text-sm font-medium shadow-lg`}
          side="bottom"
        >
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InfoItem({ label, value, theme }: any) {
  const labelColor = theme === "dark" ? "text-zinc-400" : "text-gray-500";

  return (
    <div className="flex justify-between">
      <span className={labelColor}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}
