const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Stub out react-native-maps on web to prevent native-only module errors
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    (moduleName === "react-native-maps" ||
      moduleName.startsWith("react-native-maps/"))
  ) {
    return { type: "empty" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
