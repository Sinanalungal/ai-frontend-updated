import { MdOutlineEdit } from "react-icons/md";
import { IoEyeOutline } from "react-icons/io5";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RiDeleteBinLine } from "react-icons/ri";
import { useState } from "react";
import { hexToRgba } from "@/utility/RgbaHexConvertions";

const RenderCustomAnnotationsList = ({
  drawings,
  theme,
  setDrawings,
  textColor,
  secondaryTextColor,
  viewer="default"
}: any) => {
  const [editingDrawing, setEditingDrawing] = useState<{
    id: string;
    toothNumber: string;
    pathology: string;
    customPathology: string;
  } | null>(null);

  const toggleDrawingVisibility = (drawingId: string) => {
    if (viewer === "default") {
      setDrawings((prev: any) =>
        prev.map((drawing: any) => ({
          ...drawing,
          visible: drawing.id === drawingId ? !drawing.visible : drawing.visible,
        }))
      );
    }else if (viewer ==="layer") {
      setDrawings((prev: any) =>{
        // console.log("prev", prev)
        return prev.map((layer: any) => {
          return {
            ...layer,
            drawings: layer?.drawings?.map((drawing: any) => ({
              ...drawing,
              visible: drawing.id === drawingId ? !drawing.visible : drawing.visible,
            })),
          };
        })
      });
    }
  };

  const deleteDrawing = (drawingId: string) => {
    if (viewer === "default") {
      setDrawings((prev: any) =>
        prev.filter((drawing: any) => drawing.id !== drawingId)
      );
    } else if (viewer === "layer") {
      setDrawings((prev: any) =>
        prev.map((layer: any) => ({
          ...layer,
          drawings: layer.drawings.filter(
            (drawing: any) => drawing.id !== drawingId
          ),
        }))
      );
    }
  };


  const ManageDrawerInCustom = (drawingId: string) => {
    if (viewer === "default") {
      setDrawings((prev: any) =>
        prev.map((drawing: any) =>
          drawing.id === drawingId
            ? { ...drawing, OpenDrawer: !drawing.OpenDrawer }
            : drawing
        )
      );
    }
    else if (viewer === "layer") {
      setDrawings((prev: any) =>
        prev.map((layer: any) => ({
          ...layer,
          drawings: layer.drawings.map((drawing: any) =>
            drawing.id === drawingId
              ? { ...drawing, OpenDrawer: !drawing.OpenDrawer }
              : drawing
          ),
        }))
      );
    }
  };

  // Function to update the color of a drawing
  // Takes the drawing ID, field to update (strokeColor or bgColor), and the new value
  const updateDrawingColor = (
    drawingId: string,
    field: "strokeColor" | "bgColor",
    value: string
  ) => {
    if (viewer === "default") {
      setDrawings((prev: any) =>
        prev.map((drawing: any) =>
          drawing.id === drawingId
            ? { ...drawing, [field]: value }
            : drawing
        )
      );
    } else if (viewer === "layer") {
      setDrawings((prev: any) =>
        prev.map((layer: any) => ({
          ...layer,
          drawings: layer.drawings.map((drawing: any) =>
            drawing.id === drawingId
              ? { ...drawing, [field]: value }
              : drawing
          ),
        }))
      );
    }
  };

  

  const toggleDrawingDisplay = (
    drawingId: string,
    field: "showStroke" | "showBackground"
  ) => {
    if (viewer === "default") {
      setDrawings((prev: any) =>
        prev.map((drawing: any) =>
          drawing.id === drawingId
            ? { ...drawing, [field]: !drawing[field] }
            : drawing
        )
      );
    } else if (viewer === "layer") {
      setDrawings((prev: any) =>
        prev.map((layer: any) => ({
          ...layer,
          drawings: layer.drawings.map((drawing: any) =>
            drawing.id === drawingId
              ? { ...drawing, [field]: !drawing[field] }
              : drawing
          ),
        }))
      );
    }
  };
  
  const writeText = (
    e:any,
    drawing:any,
  ) => {
    if (viewer === "default") {
      setDrawings((prev: any) =>
        prev.map((d: any) => {
          if (d.id === drawing.id) {
            return { ...d, label: e.target.value };
          }
          return d;
        })
      );
    } else if (viewer === "layer") {
      setDrawings((prev: any) =>
        prev.map((layer: any) => ({
          ...layer,
          drawings: layer.drawings.map((d: any) => {
            if (d.id === drawing.id) {
              return { ...d, label: e.target.value };
            }
            return d;
          }),
        }))
      );
    }
  };

  return (
    <div className="space-y-2 text-sm pb-[150px]">
      {drawings.length > 0 && (
        <div className="mb-4">
          {drawings.map((drawing: any) => (
            <div
              key={drawing.id}
              className={`flex flex-col ${
                theme === "dark" ? "bg-zinc-700" : "bg-gray-200"
              } py-2 px-3 mb-2 rounded`}
            >
              {editingDrawing?.id === drawing.id ? (
                <div className="flex flex-col gap-2 max-w-[60%]">
                  <input
                    type="text"
                    className={`w-full ${
                      theme === "dark"
                        ? "bg-zinc-600 text-gray-300"
                        : "bg-gray-100 text-black"
                    } text-xs px-2 py-1 rounded`}
                    value={drawing.label}
                    onChange={(e) => {
                      writeText(e, drawing);}}
                    onBlur={() => setEditingDrawing(null)}
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <div className="max-w-[60%] overflow-hidden">
                      {drawing.label.trim().length > 0 ? (
                        <span
                          className={`${textColor} text-sm block truncate`}
                          title={drawing.label}
                        >
                          {drawing.label}
                        </span>
                      ) : (
                        <span
                          className={`${secondaryTextColor} text-sm block truncate`}
                          title={drawing.label}
                        >
                          ____
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      <button
                        className="cursor-pointer"
                        onClick={() =>
                          setEditingDrawing({
                            id: drawing.id,
                            toothNumber: drawing.toothNumber || "1",
                            pathology: drawing.pathology || "Cavity",
                            customPathology: drawing.customPathology || "",
                          })
                        }
                      >
                        <MdOutlineEdit
                          size={16}
                          className={
                            theme === "dark"
                              ? "text-zinc-400 hover:text-white"
                              : "text-gray-500 hover:text-black"
                          }
                        />
                      </button>
                      <button
                        className="cursor-pointer"
                        onClick={() => toggleDrawingVisibility(drawing.id)}
                      >
                        <IoEyeOutline
                          size={20}
                          color={
                            drawing.visible
                              ? theme === "dark"
                                ? "white"
                                : "black"
                              : "grey"
                          }
                        />
                      </button>
                      <button
                        className="cursor-pointer"
                        onClick={() => deleteDrawing(drawing.id)}
                      >
                        <RiDeleteBinLine size={20} color="grey" />
                      </button>
                      <button
                        className="cursor-pointer"
                        onClick={() => ManageDrawerInCustom(drawing.id)}
                      >
                        {drawing.OpenDrawer ? (
                          <ChevronUp size={20} color="grey" />
                        ) : (
                          <ChevronDown size={20} color="grey" />
                        )}
                      </button>
                    </div>
                  </div>
                  {drawing.OpenDrawer && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={drawing.strokeColor || "#FFFFFF"}
                          onChange={(e) =>
                            updateDrawingColor(
                              drawing.id,
                              "strokeColor",
                              e.target.value
                            )
                          }
                          className="w-6 h-6"
                        />
                        <label className={`${secondaryTextColor} text-xs`}>
                          Stroke
                        </label>
                        <input
                          type="checkbox"
                          checked={drawing.showStroke}
                          onChange={() =>
                            toggleDrawingDisplay(drawing.id, "showStroke")
                          }
                          className="ml-2"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={(() => {
                            const rgbaMatch = drawing.bgColor?.match(
                              /rgba?\((\d+), ?(\d+), ?(\d+)/
                            );
                            if (rgbaMatch) {
                              const [r, g, b] = rgbaMatch.slice(1).map(Number);
                              return (
                                "#" +
                                [r, g, b]
                                  .map((x) => x.toString(16).padStart(2, "0"))
                                  .join("")
                              );
                            }
                            return "#000000"; // fallback color
                          })()}
                          onChange={(e) =>
                            updateDrawingColor(
                              drawing.id,
                              "bgColor",
                              hexToRgba(e.target.value, 0.3)
                            )
                          }
                          className="w-6 h-6"
                        />
                        <label className={`${secondaryTextColor} text-xs`}>
                          Background
                        </label>
                        <input
                          type="checkbox"
                          checked={drawing.showBackground}
                          onChange={() =>
                            toggleDrawingDisplay(drawing.id, "showBackground")
                          }
                          className="ml-2"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RenderCustomAnnotationsList