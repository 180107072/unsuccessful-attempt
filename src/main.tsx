import { StyleSheet, Text, View } from "react-native";
import { registerRootComponent } from "expo";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";

import {
  LayoutAnimator,
  ProjectionTreeAnimationEngine,
  ProjectionNodeAnimationEngine,
  CssEasingParser,
  ProjectionNode,
} from "./animation";
import { ProjectionRect } from "./animation/types";

const animator = new LayoutAnimator(
  new ProjectionTreeAnimationEngine(new ProjectionNodeAnimationEngine([])),
  new CssEasingParser(),
  []
);

export default function App() {
  const [elements, setElements] = useState([1, 2, 3]);
  const nodes = new WeakMap<ProjectionRect, ProjectionNode>();

  return (
    <View style={styles.container}>
      {elements.map((item) => (
        <View
          key={item}
          style={styles.item}
          onLayout={(event) => {
            const node = new ProjectionNode(event.nativeEvent.layout, []);
            nodes.set(event.nativeEvent.layout, node);
          }}
        >
          <Text>{item}</Text>
          <StatusBar style="auto" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  item: {
    padding: 10,
    backgroundColor: "purple",
    margin: 10,
    borderRadius: 10,
  },
});

registerRootComponent(App);
