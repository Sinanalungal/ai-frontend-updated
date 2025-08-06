import { IoEyeOutline } from "react-icons/io5";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RiDeleteBinLine } from "react-icons/ri";
import { hexToRgba, rgbaToHex } from "@/utility/RgbaHexConvertions";

// Different colors for tooth mode
const getToothColor = (index: number) => {
  const toothColors = [
    "rgba(255, 0, 0, 0.5)",    // Red
    "rgba(0, 255, 0, 0.5)",    // Green
    "rgba(0, 0, 255, 0.5)",    // Blue
    "rgba(255, 255, 0, 0.5)",  // Yellow
    "rgba(255, 0, 255, 0.5)",  // Magenta
    "rgba(0, 255, 255, 0.5)",  // Cyan
    "rgba(255, 165, 0, 0.5)",  // Orange
    "rgba(128, 0, 128, 0.5)",  // Purple
    "rgba(0, 128, 0, 0.5)",    // Dark Green
    "rgba(128, 128, 0, 0.5)",  // Olive
  ];
  return toothColors[index % toothColors.length];
};

const RenderOPGAnnotationsList = ({
  annotations,
  theme,
  editingId,
  setEditingId,
  setAnnotations,
  textColor,
  secondaryTextColor,
  viewer="default",
  checkType="qc"
}: any) => {
  // console.log(annotations,"this si the annotat");
  
  const toggleAnnotationVisibility = (className: string, coordId: string) => {
    if (viewer === "default") {
      setAnnotations((prev: any) =>
        prev.map((ann: any) => {
          if (ann.class === className) {
            return {
              ...ann,
              roi_xyxy: ann.roi_xyxy.map((coord: any) => ({
                ...coord,
                visible: coord.id === coordId ? !coord.visible : coord.visible,
              })),
            };
          }
          return ann;
        })
      );
    } else if (viewer === "layer") {
      setAnnotations((prev: any) => {
        return prev.map((layer: any) => {
          if (layer.checkType === "qc") {
            return {
              ...layer,
              annotationsQc: layer?.annotationsQc?.map((annots: any) => ({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                  ...coord,
                  visible: coord.id === coordId ? !coord.visible : coord.visible,
                })),
              })),
            };
          } else if (layer.checkType === "path") {
            return {
              ...layer,
              annotationsPath: layer?.annotationsPath?.map((annots: any) => ({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                  ...coord,
                  visible: coord.id === coordId ? !coord.visible : coord.visible,
                })),
              })),
            };
          } else if (layer.checkType === "tooth") {
            return {
              ...layer,
              annotationsTooth: layer?.annotationsTooth?.map((annots: any) => ({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                  ...coord,
                  visible: coord.id === coordId ? !coord.visible : coord.visible,
                })),
              })),
            };
          }
          return layer;
        });
      });
    }
  };

  const toggleDrawerVisiblility = (className: string, coordId: string) => {
    if(viewer=="default"){
    setAnnotations((prev: any) =>
      prev.map((ann: any) => {
        // console.log(prev,"this is prev");
        
        if (ann.class === className) {
          return {
            ...ann,
            roi_xyxy: ann.roi_xyxy.map((coord: any) => ({
              ...coord,
              openDrawer:
                coord.id === coordId ? !coord.openDrawer : coord.openDrawer,
            })),
          };
        }
        return ann;
      })
    );
  }else if (viewer == "layer"){
    setAnnotations((prev:any)=>{
      // console.log(prev,"this si the prev");
      return prev.map((layer:any)=>{
        if (layer.checkType=="qc"){
          return {
            ...layer,
            annotationsQc: layer?.annotationsQc?.map((annots:any)=>({
              ...annots,
              roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                ...coord,
                openDrawer: coord.id === coordId ? !coord.openDrawer : coord.openDrawer,
              }))
            }))
          }
        }else if (layer.checkType == "path"){
          return {
            ...layer,
            annotationsPath: layer?.annotationsPath?.map((annots:any)=>({
              ...annots,
              roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                ...coord,
                openDrawer: coord.id === coordId ? !coord.openDrawer : coord.openDrawer,
              }))
            }))
          }
        }else if (layer.checkType == "tooth"){
          return {
            ...layer,
            annotationsTooth: layer?.annotationsTooth?.map((annots:any)=>({
              ...annots,
              roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                ...coord,
                openDrawer: coord.id === coordId ? !coord.openDrawer : coord.openDrawer,
              }))
            }))
          }
        }
        return layer;
      });
      
    })
  }
  };

  const handleDelete = (className: string, coordId: string) => {
    if (viewer === "default") {
      setAnnotations((prev: any) =>
        prev
          .map((ann: any) => {
            if (ann.class === className) {
              return {
                ...ann,
                roi_xyxy: ann.roi_xyxy.filter(
                  (coord: any) => coord.id !== coordId
                ),
              };
            }
            return ann;
          })
          .filter((ann: any) => ann.roi_xyxy.length > 0)
      );
    } else if (viewer === "layer") {
      setAnnotations((prev: any) => {
        return prev.map((layer: any) => {
          if (layer.checkType === "qc") {
            return {
              ...layer,
              annotationsQc: layer?.annotationsQc?.map((annots: any) => ({
                ...annots,
                roi_xyxy: annots.roi_xyxy.filter(
                  (coord: any) => coord.id !== coordId
                ),
              })),
            };
          } else if (layer.checkType === "path") {
            return {
              ...layer,
              annotationsPath: layer?.annotationsPath?.map((annots: any) => ({
                ...annots,
                roi_xyxy: annots.roi_xyxy.filter(
                  (coord: any) => coord.id !== coordId
                ),
              })),
            };
          } else if (layer.checkType === "tooth") {
            return {
              ...layer,
              annotationsTooth: layer?.annotationsTooth?.map((annots: any) => ({
                ...annots,
                roi_xyxy: annots.roi_xyxy.filter(
                  (coord: any) => coord.id !== coordId
                ),
              })),
            };
          }
          return layer;
        });
      });
    }
  };

  const updateAnnotationLabel = (
    className: string,
    coordId: string,
    newLabel: string
  ) => {
    if(viewer == "default"){
      setAnnotations((prev: any) =>
        prev.map((ann: any) => {
          if (ann.class === className) {
            return {
              ...ann,
              roi_xyxy: ann.roi_xyxy.map((coord: any) => ({
                ...coord,
                label: coord.id === coordId ? newLabel : coord.label,
              })),
            };
          }
          return ann;
        })
      );
    }else if (viewer=="layer"){
      setAnnotations((prev:any)=>{
        return prev.map((layer:any)=>{
          if (layer.checkType=="qc"){
            return {
              ...layer,
              annotationsQc: layer?.annotationsQc?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                  ...coord,
                  label: coord.id === coordId ? newLabel : coord.label,
                }))
              }))
            }
          }else if (layer.checkType == "path"){
            return {
              ...layer,
              annotationsPath: layer?.annotationsPath?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                  ...coord,
                  label: coord.id === coordId ? newLabel : coord.label,
                }))
              }))
            }
          }else if (layer.checkType == "tooth"){
            return {
              ...layer,
              annotationsTooth: layer?.annotationsTooth?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => ({
                  ...coord,
                  label: coord.id === coordId ? newLabel : coord.label,
                }))
              }))
            }
          }
          return layer;
        });
        
      })
    }
    setEditingId(null);
  };

  const handleKeyPress = (
    e: React.KeyboardEvent,
    className: string,
    coordId: string,
    label: string
  ) => {
    if (e.key === "Enter") {
      updateAnnotationLabel(className, coordId, label);
      setEditingId(null);
    }
  };

  const updateAnnotationColor = (
    className: string,
    coordId: string,
    field: "strokeColor" | "bgColor",
    value: string
  ) => {
    if(viewer=="default"){
      setAnnotations((prev: any) =>
        prev.map((ann: any) => {
          if (ann.class === className) {
            return {
              ...ann,
              roi_xyxy: ann.roi_xyxy.map((coord: any) =>
                coord.id === coordId ? { ...coord, [field]: value } : coord
              ),
            };
          }
          return ann;
        })
      );
    }else if (viewer=="layer"){
      setAnnotations((prev:any)=>{
        return prev.map((layer:any)=>{
          if (layer.checkType=="qc"){
            return {
              ...layer,
              annotationsQc: layer?.annotationsQc?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => (coord.id === coordId ? { ...coord, [field]: value } : coord))
              }))
            }
          }else if (layer.checkType == "path"){
            return {
              ...layer,
              annotationsPath: layer?.annotationsPath?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => (coord.id === coordId ? { ...coord, [field]: value } : coord))
              }))
            }
          }else if (layer.checkType == "tooth"){
            return {
              ...layer,
              annotationsTooth: layer?.annotationsTooth?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => (coord.id === coordId ? { ...coord, [field]: value } : coord))
              }))
            }
          }
          return layer;
        });
        
      })
    }
  };

  const toggleAnnotationDisplay = (
    className: string,
    coordId: string,
    field: "showStroke" | "showBackground"
  ) => {
    if(viewer=="default"){
      setAnnotations((prev: any) =>
        prev.map((ann: any) => {
          if (ann.class === className) {
            return {
              ...ann,
              roi_xyxy: ann.roi_xyxy.map((coord: any) =>
                coord.id === coordId
                  ? { ...coord, [field]: !coord[field] }
                  : coord
              ),
            };
          }
          return ann;
        })
      );
    }else if (viewer == "layer"){
      setAnnotations((prev:any)=>{
        return prev.map((layer:any)=>{
          if (layer.checkType=="qc"){
            return {
              ...layer,
              annotationsQc: layer?.annotationsQc?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => (coord.id === coordId
                  ? { ...coord, [field]: !coord[field] }
                  : coord))
              }))
            }
          }else if (layer.checkType == "path"){
            return {
              ...layer,
              annotationsPath: layer?.annotationsPath?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => (coord.id === coordId
                  ? { ...coord, [field]: !coord[field] }
                  : coord))
              }))
            }
          }else if (layer.checkType == "tooth"){
            return {
              ...layer,
              annotationsTooth: layer?.annotationsTooth?.map((annots:any)=>({
                ...annots,
                roi_xyxy: annots.roi_xyxy.map((coord: any) => (coord.id === coordId
                  ? { ...coord, [field]: !coord[field] }
                  : coord))
              }))
            }
          }
          return layer;
        });
        
      })
    }
  };

  return (
    <div className="space-y-2 text-sm pb-[150px] z-50">
      {annotations?.map((annotation: any) => (
        <div key={annotation.class} className="mb-4">
          {annotation.roi_xyxy.map((coord: any) => (
            <div
              key={coord.id}
              className={`flex flex-col ${
                theme === "dark" ? "bg-zinc-700" : "bg-gray-200"
              } py-2 px-3 mb-2 rounded`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center max-w-[60%]">
                  {editingId === coord.id ? (
                    <input
                      type="text"
                      value={coord.label}
                      onChange={(e) => {
                        setAnnotations((prev: any) =>
                          prev.map((ann: any) => ({
                            ...ann,
                            roi_xyxy: ann.roi_xyxy.map((c: any) =>
                              c.id === coord.id
                                ? { ...c, label: e.target.value }
                                : c
                            ),
                          }))
                        );
                      }}
                      onBlur={() => setEditingId(null)}
                      onKeyPress={(e) =>
                        handleKeyPress(
                          e,
                          annotation.class,
                          coord.id,
                          coord.label
                        )
                      }
                      className={`w-16 px-2 py-1 ${
                        theme === "dark"
                          ? "bg-zinc-600 text-white"
                          : "bg-gray-100 text-black"
                      } border ${
                        theme === "dark" ? "border-zinc-500" : "border-gray-300"
                      } rounded`}
                      autoFocus
                    />
                  ) : (
                    <div className="flex gap-1 text-sm overflow-hidden">
                      {checkType !== "tooth" && (
                        <span
                          className={textColor}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {coord.label}.
                        </span>
                      )}
                      <span
                        className={textColor}
                        style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {annotation.class}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <button
                    className="cursor-pointer"
                    onClick={() =>
                      toggleAnnotationVisibility(annotation.class, coord.id)
                    }
                  >
                    <IoEyeOutline
                      size={20}
                      color={
                        coord.visible
                          ? theme === "dark"
                            ? "white"
                            : "black"
                          : "grey"
                      }
                    />
                  </button>
                  <button
                    className="cursor-pointer"
                    onClick={() => handleDelete(annotation.class, coord.id)}
                  >
                    <RiDeleteBinLine size={20} color="grey" />
                  </button>
                  <button
                    className="cursor-pointer"
                    onClick={() =>
                      toggleDrawerVisiblility(annotation.class, coord.id)
                    }
                  >
                    {coord.openDrawer ? (
                      <ChevronUp size={20} color="grey" />
                    ) : (
                      <ChevronDown size={20} color="grey" />
                    )}
                  </button>
                </div>
              </div>
              {coord.openDrawer && (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        coord.strokeColor
                          ? rgbaToHex(coord.strokeColor)
                          : checkType === "tooth" 
                            ? rgbaToHex(getToothColor(annotation.roi_xyxy.indexOf(coord)))
                            : "#FF0000"
                      }
                      onChange={(e) =>
                        updateAnnotationColor(
                          annotation.class,
                          coord.id,
                          "strokeColor",
                          hexToRgba(e.target.value)
                        )
                      }
                      className="w-6 h-6"
                    />
                    <label className={`${secondaryTextColor} text-xs`}>
                      Stroke
                    </label>
                    <input
                      type="checkbox"
                      checked={coord.showStroke}
                      onChange={() =>
                        toggleAnnotationDisplay(
                          annotation.class,
                          coord.id,
                          "showStroke"
                        )
                      }
                      className="ml-2"
                    />
                  </div>
                  {/* {checkType == "path" && ( */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        coord.bgColor 
                          ? rgbaToHex(coord.bgColor) 
                          : checkType === "tooth" 
                            ? rgbaToHex(getToothColor(annotation.roi_xyxy.indexOf(coord)))
                            : "#ff0000"
                      }
                      onChange={(e) =>
                        updateAnnotationColor(
                          annotation.class,
                          coord.id,
                          "bgColor",
                          `${hexToRgba(e.target.value, 0.5)}`
                        )
                      }
                      className="w-6 h-6"
                    />
                    <label className={`${secondaryTextColor} text-xs`}>
                      Background
                    </label>
                    <input
                      type="checkbox"
                      checked={coord.showBackground}
                      onChange={() =>
                        toggleAnnotationDisplay(
                          annotation.class,
                          coord.id,
                          "showBackground"
                        )
                      }
                      className="ml-2"
                    />
                  </div>
                  {/* )} */}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default RenderOPGAnnotationsList;
