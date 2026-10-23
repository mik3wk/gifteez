module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Last. The Reanimated plugin is the Worklets plugin, so do not list both.
  // Jest has no worklet runtime; the setup file mocks the JS API instead.
  plugins: process.env.NODE_ENV === 'test' ? [] : ['react-native-reanimated/plugin'],
};
