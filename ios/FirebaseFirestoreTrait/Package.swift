// swift-tools-version:6.2
import PackageDescription

// Xcode 26.2 does not read `traits` on an XCRemoteSwiftPackageReference (that
// key is an Xcode 26.4 project-file feature). SwiftPM 6.2.3, which ships with
// Xcode 26.2, also turns an unspecified trait set into ["default"] and then
// drops that set before it applies target settings, so Firebase's default
// Firestore trait stays off and FirebaseFirestoreWrap/dummy.m fails.
//
// A package dependency that names the trait is applied by that same SwiftPM.
// Trait sets are unioned, so this edge enables Firestore for the shared
// firebase-ios-sdk package even when the Xcode project reference contributes
// no traits. The exact version matches the pin in
// @react-native-firebase/app sdkVersions.ios.firebase (RNFB 27: 13.0.0).
// ios/firebase_spm_traits.rb rewrites the exact version if that pin changes.
let package = Package(
    name: "FirebaseFirestoreTrait",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "FirebaseFirestoreTrait", targets: ["FirebaseFirestoreTrait"]),
    ],
    dependencies: [
        .package(
            url: "https://github.com/firebase/firebase-ios-sdk.git",
            exact: "13.0.0",
            traits: [
                "Firestore",
                .defaults,
            ]
        ),
    ],
    targets: [
        .target(
            name: "FirebaseFirestoreTrait",
            dependencies: [
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
            ],
            path: "Sources/FirebaseFirestoreTrait"
        ),
    ]
)
