import CryptoKit
import Foundation

enum AuthError: LocalizedError {
    case invalidUsername
    case shortPassword
    case passwordMismatch
    case accountExists
    case invalidCredentials

    var errorDescription: String? {
        switch self {
        case .invalidUsername: "账号至少需要 3 个字符"
        case .shortPassword: "密码至少需要 6 位"
        case .passwordMismatch: "两次输入的密码不一致"
        case .accountExists: "本机已经存在账号"
        case .invalidCredentials: "账号或密码不正确"
        }
    }
}

@MainActor
final class AuthStore: ObservableObject {
    private struct Account: Codable {
        var username: String
        var salt: String
        var passwordHash: String
        var createdAt: Date
    }

    @Published private(set) var isAuthenticated = false
    @Published private(set) var username = ""
    @Published private(set) var hasAccount = false

    private let accountKey = "thermalGuard.mac.auth.account"
    private let sessionKey = "thermalGuard.mac.auth.session"
    private let defaults = UserDefaults.standard

    init() {
        hasAccount = loadAccount() != nil
        if let account = loadAccount(), defaults.bool(forKey: sessionKey) {
            username = account.username
            isAuthenticated = true
        }
    }

    func createAccount(username: String, password: String, confirmation: String) throws {
        let cleanUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanUsername.count >= 3 else { throw AuthError.invalidUsername }
        guard password.count >= 6 else { throw AuthError.shortPassword }
        guard password == confirmation else { throw AuthError.passwordMismatch }
        guard loadAccount() == nil else { throw AuthError.accountExists }

        let salt = UUID().uuidString
        let account = Account(username: cleanUsername, salt: salt, passwordHash: hash(password, salt: salt), createdAt: Date())
        if let data = try? JSONEncoder().encode(account) {
            defaults.set(data, forKey: accountKey)
            defaults.set(true, forKey: sessionKey)
            hasAccount = true
            self.username = cleanUsername
            isAuthenticated = true
        }
    }

    func login(username: String, password: String) throws {
        guard let account = loadAccount(),
              username.trimmingCharacters(in: .whitespacesAndNewlines) == account.username,
              hash(password, salt: account.salt) == account.passwordHash else {
            throw AuthError.invalidCredentials
        }
        defaults.set(true, forKey: sessionKey)
        self.username = account.username
        isAuthenticated = true
    }

    func logout() {
        defaults.set(false, forKey: sessionKey)
        username = ""
        isAuthenticated = false
    }

    func resetAccount() {
        defaults.removeObject(forKey: accountKey)
        defaults.set(false, forKey: sessionKey)
        hasAccount = false
        username = ""
        isAuthenticated = false
    }

    private func loadAccount() -> Account? {
        guard let data = defaults.data(forKey: accountKey) else { return nil }
        return try? JSONDecoder().decode(Account.self, from: data)
    }

    private func hash(_ password: String, salt: String) -> String {
        let digest = SHA256.hash(data: Data("\(salt):\(password)".utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
