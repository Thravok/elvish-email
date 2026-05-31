import Foundation

enum AppEnvironment {
    /// Base URL for `/api/...` (no trailing slash). Overridable via Info.plist `ElvishAPIBaseURL`.
    static var apiBaseURL: URL {
        if let s = Bundle.main.object(forInfoDictionaryKey: "ElvishAPIBaseURL") as? String,
           let u = URL(string: s.trimmingCharacters(in: .whitespacesAndNewlines)),
           var c = URLComponents(url: u, resolvingAgainstBaseURL: false)
        {
            if c.path == "/" { c.path = "" }
            return c.url ?? u
        }
        return URL(string: "https://elvish.quest")!
    }
}
