import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit

class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)
    window?.backgroundColor = Self.launchBackground
    
    #if DEBUG
    let devMenuConfiguration = RCTDevMenuConfiguration(
      devMenuEnabled: true,
      shakeGestureEnabled: true,
      keyboardShortcutsEnabled: true
    )
    reactNativeFactory?.devMenuConfiguration = devMenuConfiguration
    #endif
    
    reactNativeFactory?.startReactNative(
      withModuleName: "Gifteez",
      in: window,
      connectionOptions: connectionOptions
    )

   
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }

  override func customize(_ rootView: RCTRootView) {
    rootView.backgroundColor = Self.launchBackground
    // The new-architecture root view is an RCTSurfaceHostingProxyRootView. The
    // protocol types it as RCTRootView; both classes implement setLoadingView:,
    // which covers the storyboard-to-JS gap with the same 240pt centred logo.
    rootView.loadingView = Self.launchLogo()
    rootView.loadingViewFadeDelay = 0
    rootView.loadingViewFadeDuration = 0
  }

  /// Matches LaunchScreen.storyboard: SplashLogo, 240×240, centred on LaunchBackground.
  private static func launchLogo() -> UIView {
    let host = UIView()
    host.backgroundColor = launchBackground
    host.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    let logo = UIImageView(image: UIImage(named: "SplashLogo"))
    logo.contentMode = .scaleAspectFit
    logo.translatesAutoresizingMaskIntoConstraints = false
    host.addSubview(logo)
    NSLayoutConstraint.activate([
      logo.centerXAnchor.constraint(equalTo: host.centerXAnchor),
      logo.centerYAnchor.constraint(equalTo: host.centerYAnchor),
      logo.widthAnchor.constraint(equalToConstant: 240),
      logo.heightAnchor.constraint(equalToConstant: 240),
    ])
    return host
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }

  /// Matches LaunchBackground.colorset so the window does not flash white or black.
  private static var launchBackground: UIColor {
    UIColor(named: "LaunchBackground") ?? UIColor(red: 1, green: 0.965, blue: 0.914, alpha: 1)
  }
}
