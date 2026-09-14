import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var authStore: AuthStore

    @State private var mode: Mode = .login
    @State private var username = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var errorMessage = ""

    private enum Mode { case login, register }

    var body: some View {
        ZStack {
            AppBackground()

            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 13) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 14)
                            .fill(LinearGradient(colors: [.blue, .cyan], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .frame(width: 52, height: 52)
                        Image(systemName: "shield.lefthalf.filled")
                            .font(.system(size: 25, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text("热感哨兵")
                            .font(.system(size: 19, weight: .bold))
                        Text("AI火警网警安全登录")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.cyan)
                            .tracking(1.1)
                    }
                }

                VStack(alignment: .leading, spacing: 7) {
                    Text(mode == .login ? "欢迎回来" : "首次使用")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.cyan)
                    Text(mode == .login ? "登录系统" : "创建本机账号")
                        .font(.system(size: 30, weight: .bold))
                    Text(mode == .login ? "输入手机端设置的账号和密码。" : "账号与哈希后的密码只保存在这台 Mac。")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 13) {
                    field(title: "账号", icon: "person.fill") {
                        TextField("请输入账号", text: $username)
                            .textFieldStyle(.plain)
                    }
                    field(title: "密码", icon: "key.fill") {
                        SecureField("至少6位密码", text: $password)
                            .textFieldStyle(.plain)
                    }
                    if mode == .register {
                        field(title: "确认密码", icon: "key.fill") {
                            SecureField("再次输入密码", text: $confirmation)
                                .textFieldStyle(.plain)
                        }
                    }
                }

                if !errorMessage.isEmpty {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.red)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                }

                Button {
                    submit()
                } label: {
                    Label(mode == .login ? "登录" : "创建账号并登录", systemImage: mode == .login ? "lock.open.fill" : "person.badge.plus")
                        .font(.system(size: 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                HStack {
                    if authStore.hasAccount {
                        Button(mode == .login ? "重新设置账号" : "返回登录") {
                            mode = mode == .login ? .register : .login
                            password = ""
                            confirmation = ""
                            errorMessage = ""
                        }
                        .buttonStyle(.link)
                    }
                    Spacer()
                    if authStore.hasAccount {
                        Button("清除本机账号", role: .destructive) {
                            authStore.resetAccount()
                            mode = .register
                            username = ""
                            password = ""
                            confirmation = ""
                            errorMessage = ""
                        }
                        .buttonStyle(.link)
                    }
                }
                .font(.system(size: 10))

                Text("本机认证用于演示，不会把密码发送到服务器；跨设备登录需要正式账号服务。")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(30)
            .frame(width: 440)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
            .overlay {
                RoundedRectangle(cornerRadius: 24)
                    .stroke(Color.cyan.opacity(0.18), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.3), radius: 35, y: 18)
            .padding(40)
        }
        .onAppear {
            mode = authStore.hasAccount ? .login : .register
        }
    }

    @ViewBuilder
    private func field<Content: View>(title: String, icon: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(.cyan)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
                content()
                    .font(.system(size: 13))
            }
        }
        .padding(12)
        .background(.black.opacity(0.16), in: RoundedRectangle(cornerRadius: 11))
        .overlay {
            RoundedRectangle(cornerRadius: 11)
                .stroke(Color.blue.opacity(0.14), lineWidth: 1)
        }
    }

    private func submit() {
        errorMessage = ""
        do {
            if mode == .login {
                try authStore.login(username: username, password: password)
            } else {
                try authStore.createAccount(username: username, password: password, confirmation: confirmation)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
