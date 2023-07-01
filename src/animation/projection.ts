import {
  BoundingBox,
  TransformAxisConfig,
  TransformConfig,
} from "./projection-core";
import { ProjectionRect } from "./types";

export interface ProjectionComponent<Properties extends object = object> {
  measureProperties(element: HTMLElement, boundingBox: BoundingBox): Properties;
  cancelDistortion(
    element: HTMLElement,
    measured: Properties,
    distortion: ProjectionDistortion
  ): void;
}

export class ProjectionNode {
  static idNext = 1;

  id = `anonymous-${ProjectionNode.idNext++}`;
  activated = true;

  parent?: ProjectionNode;
  children = new Set<ProjectionNode>();

  boundingBox?: BoundingBox;
  transform?: TransformConfig;

  protected identified = false;

  constructor(
    public element: ProjectionRect,
    protected components: ProjectionComponent[]
  ) {}

  identifyAs(id: string): void {
    if (this.identified)
      throw new Error(`Node "${this.id}" already identified`);
    this.id = id;
    this.identified = true;
  }

  activate(): void {
    this.activated = true;
  }
  deactivate(): void {
    this.activated = false;
  }

  attach(parent: ProjectionNode): void {
    this.parent = parent;
    parent.children.add(this);
  }
  detach(): void {
    if (!this.parent) throw new Error("Missing parent");
    this.parent.children.delete(this);
    this.parent = undefined;
  }

  traverse(
    callback: (node: ProjectionNode) => void,
    options: ProjectionNodeTraverseOptions = {}
  ): void {
    options.includeSelf ??= false;
    options.includeDeactivated ??= false;

    if (options.includeSelf) callback(this);

    this.children.forEach((child) => {
      if (!options.includeDeactivated && !child.activated) return;
      child.traverse(callback, { ...options, includeSelf: true });
    });
  }
  track(): ProjectionNode[] {
    const path = [];
    let ancestor = this.parent;
    while (ancestor) {
      path.unshift(ancestor);
      ancestor = ancestor.parent;
    }
    return path;
  }

  reset(): void {
    this.transform = undefined;
  }

  measure(): void {
    const boundingBox = BoundingBox.from(this.element);
    this.boundingBox = boundingBox;
    this.components.forEach((c) =>
      Object.assign(this, c.measureProperties(this.element, boundingBox))
    );
  }
  measured(): this is MeasuredProjectionNode {
    return !!this.boundingBox;
  }

  project(destBoundingBox: BoundingBox): void {
    if (!this.measured()) throw new Error("Node not measured");

    this.transform = this.calculateTransform(destBoundingBox);

    const ancestorTotalScale = { x: 1, y: 1 };
    const ancestors = this.track();
    for (const ancestor of ancestors) {
      if (!ancestor.transform) continue;
      ancestorTotalScale.x *= ancestor.transform.x.scale;
      ancestorTotalScale.y *= ancestor.transform.y.scale;
    }

    const transform = this.transform;
    const translateX = transform.x.translate / ancestorTotalScale.x;
    const translateY = transform.y.translate / ancestorTotalScale.y;

    console.log(transform);
    //   !!!

    const distortion: ProjectionDistortion = {
      scaleX: ancestorTotalScale.x * this.transform.x.scale,
      scaleY: ancestorTotalScale.y * this.transform.y.scale,
    };
    this.components.forEach((c) => {
      c.cancelDistortion(this.element, this, distortion);
    });
  }

  calculateTransform(destBoundingBox: BoundingBox): TransformConfig {
    const currBoundingBox = this.calculateTransformedBoundingBox();
    const currMidpoint = currBoundingBox.midpoint();
    const destMidpoint = destBoundingBox.midpoint();

    const transform: TransformConfig = {
      x: new TransformAxisConfig({
        origin: currMidpoint.x,
        scale: destBoundingBox.width / currBoundingBox.width,
        translate: destMidpoint.x - currMidpoint.x,
      }),
      y: new TransformAxisConfig({
        origin: currMidpoint.y,
        scale: destBoundingBox.height / currBoundingBox.height,
        translate: destMidpoint.y - currMidpoint.y,
      }),
    };

    if (isNaN(transform.x.scale)) transform.x.scale = 1;
    if (isNaN(transform.y.scale)) transform.y.scale = 1;

    return transform;
  }

  calculateTransformedBoundingBox(): BoundingBox {
    if (!this.measured()) throw new Error("Node not measured");
    let boundingBox = this.boundingBox;
    for (const ancestor of this.track()) {
      if (!ancestor.boundingBox || !ancestor.transform) continue;
      const transform = ancestor.transform;
      boundingBox = new BoundingBox({
        x: transform.y.apply(boundingBox.x),
        y: transform.x.apply(boundingBox.y),
        width: transform.x.apply(boundingBox.width),
        height: transform.y.apply(boundingBox.height),
      });
    }
    return boundingBox;
  }

  [prop: PropertyKey]: unknown;
}
export type MeasuredProjectionNode = ProjectionNode &
  Required<Pick<ProjectionNode, "boundingBox">>;
export interface ProjectionNodeTraverseOptions {
  includeSelf?: boolean;
  includeDeactivated?: boolean;
}

export interface ProjectionDistortion {
  scaleX: number;
  scaleY: number;
}
