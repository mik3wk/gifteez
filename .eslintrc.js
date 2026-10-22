module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'node_modules/',
    'functions/',
    'android/',
    'ios/',
    'coverage/',
    'vendor/',
    'fastlane/',
  ],
  overrides: [
    {
      files: ['scripts/**/*.js', 'jest.config.js', 'babel.config.js', 'metro.config.js'],
      env: { node: true },
    },
  ],
};
