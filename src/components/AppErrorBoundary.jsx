import { Component } from "react";
import { View } from "react-native";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";

// An error thrown while drawing a screen used to take the whole app down — on a release build the
// app simply closed. This catches it and offers a way back instead. Location tracking and the
// rider's duty status live outside React and on the server, so starting over loses nothing.
export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
        <Text className="text-center font-jakarta-bold text-lg">Something went wrong</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Your duty status hasn&rsquo;t changed. Tap below to carry on.
        </Text>
        <Button onPress={() => this.setState({ failed: false })}>Back to the app</Button>
      </View>
    );
  }
}
