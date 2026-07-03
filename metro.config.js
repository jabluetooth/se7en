const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Firebase v10 ships platform-specific builds. Without this, Metro resolves
// @firebase/auth to the browser build (no registerAuth("ReactNative") call),
// which causes "Component auth has not been registered yet" at runtime.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

// functions/ is a separate deployable unit (Firebase Cloud Functions, Node.js
// runtime) with its own package.json and node_modules — it is never imported
// by the RN app. Without this, Metro's default watchFolders (the whole repo)
// picks it up and tries to resolve its "main": "lib/index.js", which fails
// whenever functions/lib hasn't been built locally.
const functionsDirEscaped = path.resolve(__dirname, 'functions').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList ? [config.resolver.blockList] : [];
config.resolver.blockList = [
  ...existingBlockList,
  new RegExp(`^${functionsDirEscaped}[\\\\/].*`),
];

// @neondatabase/serverless optionally imports the Node.js `ws` package for
// WebSocket pool connections. We only use the HTTP-mode neon() function, so
// we shim `ws` to an empty module so Metro doesn't try to bundle Node.js
// internals (net, tls, etc.) that don't exist in React Native.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ws: path.resolve(__dirname, 'shims/ws.js'),
};

module.exports = config;
