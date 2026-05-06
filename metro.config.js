const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase v10 ships platform-specific builds. Without this, Metro resolves
// @firebase/auth to the browser build (no registerAuth("ReactNative") call),
// which causes "Component auth has not been registered yet" at runtime.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = config;
