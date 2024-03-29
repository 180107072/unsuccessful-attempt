import { easeIn, easeInOut, easeOut, Easing, linear } from "popmotion";

import { AnimationRef, AnimationResult } from "./animation-core";
import {
  AnimationPlan,
  AnimationRoute,
  ProjectionTreeAnimationEngine,
} from "./animation-engines";
import { MeasuredProjectionNode, ProjectionNode } from "./projection";
import { BoundingBox } from "./projection-core";
import {
  ProjectionNodeSnapper,
  ProjectionNodeSnapshot,
  ProjectionNodeSnapshotMap,
  ProjectionTreeSnapshotOptions,
} from "./snapshot";

export interface AnimationPlanner {
  buildPlan(context: AnimationPlanningContext<object>): Partial<AnimationPlan>;
}
export interface AnimationPlanningContext<NodeProperties extends object> {
  root: MeasuredProjectionNode & NodeProperties;
  node: MeasuredProjectionNode & NodeProperties;
  snapshot?: ProjectionNodeSnapshot & NodeProperties;
  snapshots: ProjectionNodeSnapshotMap;
}

export class LayoutAnimator {
  constructor(
    protected engine: ProjectionTreeAnimationEngine,
    protected easingParser: CssEasingParser,
    protected planners: AnimationPlanner[]
  ) {}

  animate(config: LayoutAnimationConfig): AnimationRef {
    const { root, from: snapshots, estimation = false } = config;
    if (typeof config.easing === "string")
      config.easing = this.easingParser.parse(config.easing);
    const { duration = 225, easing = easeInOut } = config;

    this.initialize(root);
    const plans = this.getAnimationPlans(root, snapshots, estimation);
    const ref = this.engine.animate(root, { duration, easing, plans });

    ref.then((result) => {
      if (result === AnimationResult.Completed)
        root.traverse((node) => node.reset(), { includeSelf: true });
    });

    return ref;
  }

  protected initialize(root: ProjectionNode): void {
    root.traverse((node) => node.reset(), { includeSelf: true });
    root.traverse((node) => node.measure(), { includeSelf: true });
  }

  protected getAnimationPlans(
    root: ProjectionNode,
    snapshots: ProjectionNodeSnapshotMap,
    estimation: boolean
  ): Map<ProjectionNode["id"], AnimationPlan> {
    const map = new Map<ProjectionNode["id"], AnimationPlan>();

    root.traverse(
      (node) => {
        if (!node.measured()) throw new Error("Unknown node");

        const snapshot = snapshots.get(node.id);

        if (map.has(node.id) && node.element === snapshot?.element) return;

        const context: AnimationPlanningContext<object> = {
          root: root as MeasuredProjectionNode,
          ...{ node, snapshots, snapshot },
        };

        const plan: AnimationPlan = {
          ...this.planners.reduce(
            (plan, planner) => ({
              ...plan,
              ...planner.buildPlan(context),
            }),
            {}
          ),
          boundingBox: this.getBoundingBoxRoute(context, estimation),
        };

        map.set(node.id, plan);
      },
      { includeSelf: true }
    );

    return map;
  }

  protected getBoundingBoxRoute(
    context: AnimationPlanningContext<object>,
    estimation: boolean
  ): AnimationRoute<BoundingBox> {
    const { root, node, snapshot, snapshots } = context;
    const from =
      snapshot?.boundingBox ||
      (estimation &&
        this.estimateBoundingBoxRouteStart(root, node, snapshots)) ||
      node.boundingBox;
    const to = node.boundingBox;
    return { from, to };
  }

  protected estimateBoundingBoxRouteStart(
    root: MeasuredProjectionNode,
    node: MeasuredProjectionNode,
    snapshots: ProjectionNodeSnapshotMap
  ): BoundingBox | undefined {
    if (!node.measured()) throw new Error("Unknown node");

    let ancestor: ProjectionNode = node;
    let ancestorSnapshot: ProjectionNodeSnapshot | undefined = undefined;
    while ((ancestorSnapshot = snapshots.get(ancestor.id)) === undefined) {
      if (ancestor === root || !ancestor.parent) return;
      ancestor = ancestor.parent;
    }
    if (!ancestor.measured()) throw new Error("Unknown ancestor");

    const transform = ancestor.calculateTransform(ancestorSnapshot.boundingBox);
    const scale = transform.x.scale;

    return new BoundingBox({
      x:
        ancestorSnapshot.boundingBox.x -
        (ancestor.boundingBox.x - node.boundingBox.x) * scale,
      y:
        ancestorSnapshot.boundingBox.y -
        (ancestor.boundingBox.y - node.boundingBox.y) * scale,
      width:
        ancestorSnapshot.boundingBox.width -
        (ancestor.boundingBox.width - node.boundingBox.width) * scale,
      height:
        ancestorSnapshot.boundingBox.height -
        (ancestor.boundingBox.height - node.boundingBox.height) * scale,
    });
  }
}

export interface LayoutAnimationConfig {
  root: ProjectionNode;
  from: ProjectionNodeSnapshotMap;
  duration?: number;
  easing?: string | Easing;
  estimation?: boolean;
}

export class LayoutAnimationEntry {
  readonly node: ProjectionNode;
  readonly snapshots: ProjectionNodeSnapshotMap;
  protected animator: LayoutAnimator;
  protected snapper: ProjectionNodeSnapper;
  protected animationConfig: LayoutAnimationEntryAnimationConfig;

  constructor(config: LayoutAnimationEntryConfig) {
    this.node = config.node;
    this.snapshots = config.storage ?? new ProjectionNodeSnapshotMap();
    [this.animator, this.snapper] = config.deps;
    this.animationConfig = config.animation ?? {};
  }

  snapshot(options?: ProjectionTreeSnapshotOptions): void {
    const snapshots = this.snapper.snapshotTree(this.node, options);
    this.snapshots.merge(snapshots);
  }

  animate(config?: LayoutAnimationEntryAnimationConfig): AnimationRef {
    return this.animator.animate({
      ...this.animationConfig,
      ...config,
      root: this.node,
      from: this.snapshots,
    });
  }
}

export interface LayoutAnimationEntryConfig {
  node: ProjectionNode;
  deps: [LayoutAnimator, ProjectionNodeSnapper];
  storage?: ProjectionNodeSnapshotMap;
  animation?: LayoutAnimationEntryAnimationConfig;
}

export interface LayoutAnimationEntryAnimationConfig
  extends Omit<LayoutAnimationConfig, "root" | "from"> {}

export class CssEasingParser {
  parse(easing: string): Easing {
    const easings = new Map<string, Easing>([
      ["linear", linear],
      ["ease", easeInOut],
      ["ease-in", easeIn],
      ["ease-out", easeOut],
    ]);

    if (easings.has(easing)) return easings.get(easing)!;

    // const [a, b, c, d] = easing
    //   .replace("cubic-bezier(", "")
    //   .replace(")", "")
    //   .split(",")
    //   .map((v) => parseFloat(v));
    // return cubicBezier(a, b, c, d);

    throw new Error(`Unsupported easing string: ${easing}`);
  }
}
