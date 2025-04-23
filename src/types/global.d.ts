export interface Drawing {
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

export interface Annotation {
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

export interface UploadResponse {
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
