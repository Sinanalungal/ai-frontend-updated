export function hexToRgba(hex: string, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

export const rgbaToHex = (rgba: string) => {
    const result = rgba.match(/\d+/g);
    if (!result) return "#000000";
    const [r, g, b] = result.map(Number);
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x?.toString(16);
          return hex?.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  };
  