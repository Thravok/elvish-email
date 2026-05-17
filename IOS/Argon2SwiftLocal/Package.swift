// swift-tools-version:5.10
// Local Argon2Swift fork: correct SPM `exclude` paths so `src/opt.c` is not built on arm64 simulator.

import PackageDescription

let package = Package(
    name: "Argon2Swift",
    platforms: [
        .macOS(.v13),
        .iOS(.v15),
        .tvOS(.v15),
        .watchOS(.v9),
    ],
    products: [
        .library(name: "Argon2Swift", targets: ["Argon2Swift"]),
    ],
    targets: [
        .target(
            name: "Argon2",
            dependencies: [],
            path: "Sources/Argon2",
            exclude: [
                "src/opt.c",
                "src/bench.c",
                "src/run.c",
                "src/test.c",
                "src/genkat.c",
                "src/genkat.h",
                "src/blake2/blamka-round-opt.h",
            ]),
        .target(name: "Argon2Swift", dependencies: ["Argon2"], path: "Sources/Swift"),
        .testTarget(name: "Argon2SwiftTests", dependencies: ["Argon2Swift"], path: "Tests"),
    ]
)
