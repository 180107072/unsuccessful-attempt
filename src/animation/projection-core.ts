import { mix } from "popmotion";
import { ProjectionRect } from "./types";

export class BoundingBox {
  static from(rect: ProjectionRect): BoundingBox {
    return new BoundingBox(rect);
  }

  x: number;
  y: number;
  width: number;
  height: number;

  constructor(data: ProjectionRect) {
    this.x = data.x;
    this.y = data.y;
    this.width = data.width;
    this.height = data.height;
  }

  midpoint(): { x: number; y: number } {
    return {
      x: mix(this.x, this.width, 0.5),
      y: mix(this.y, this.height, 0.5),
    };
  }
}

export interface TransformConfig {
  x: TransformAxisConfig;
  y: TransformAxisConfig;
}

export class TransformAxisConfig {
  origin: number;
  scale: number;
  translate: number;

  constructor(data: Omit<TransformAxisConfig, "apply">) {
    this.origin = data.origin;
    this.scale = data.scale;
    this.translate = data.translate;
  }

  apply(value: number): number {
    const distanceFromOrigin = value - this.origin;
    const scaled = this.origin + distanceFromOrigin * this.scale;
    const translated = scaled + this.translate;
    return translated;
  }
}
