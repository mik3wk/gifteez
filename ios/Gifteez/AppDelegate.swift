import FirebaseCore
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // SceneDelegate starts the React Native factory after this returns.
    configureFirebaseIfReady()
    return true
  }
}

/// Configures Firebase only when GoogleService-Info.plist is present and real.
/// A missing or placeholder plist must not crash: the JS dev-config screen explains it.
private func configureFirebaseIfReady() {
  guard FirebaseApp.app() == nil else {
    return
  }
  guard
    let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
    let options = FirebaseOptions(contentsOfFile: path),
    !firebaseValueIsPlaceholder(options.googleAppID),
    !firebaseValueIsPlaceholder(options.gcmSenderID),
    !firebaseValueIsPlaceholder(options.apiKey),
    !firebaseValueIsPlaceholder(options.projectID)
  else {
    return
  }
  FirebaseApp.configure(options: options)
}

/// Keep this in step with `isPlaceholder` in src/config/env.ts.
private func firebaseValueIsPlaceholder(_ value: String?) -> Bool {
  guard let raw = value?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
    return true
  }
  let lower = raw.lowercased()
  if lower.hasPrefix("your-") || lower.hasPrefix("sk-your-") || lower.hasPrefix("g-xxxx") {
    return true
  }
  if lower.contains("your-project-id") || lower.contains("0000000000000000") {
    return true
  }
  return raw == "000000000000" || raw == "G-XXXXXXXXXX"
}
