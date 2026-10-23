module.exports = {
  assets: ['./assets/fonts'],
  project: {
    ios: {
      // CLI 20 defaults this to true and then runs pod install with
      // RCT_NEW_ARCH_ENABLED=0 when Pods.xcodeproj is absent. There is no
      // --no-install flag. npm run ios installs pods itself; the Podfile also
      // forces the flag so a direct `pod install` still succeeds.
      automaticPodsInstallation: false,
    },
  },
};
