import SwiftUI
import Foundation

// MARK: - User Authentication Model
@MainActor
class AuthenticationService: ObservableObject {
    @Published private(set) var currentUser: User?
    @Published var isAuthenticated = false
    
    private let apiClient: APIClient
    private let tokenStorage = TokenStorage()
    
    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }
    
    /// Authenticate user with credentials
    func authenticate(username: String, password: String) async throws -> User {
        let credentials = Credentials(username: username, password: password)
        let response = try await apiClient.post("/auth/login", body: credentials)
        
        guard let token = response.token else {
            throw AuthError.invalidCredentials
        }
        
        tokenStorage.save(token)
        let user = try await fetchCurrentUser()
        
        await MainActor.run {
            self.currentUser = user
            self.isAuthenticated = true
        }
        
        return user
    }
    
    @MainActor
    func logout() {
        currentUser = nil
        isAuthenticated = false
        tokenStorage.clear()
    }
    
    private func fetchCurrentUser() async throws -> User {
        return try await apiClient.get("/users/me")
    }
}

// SwiftUI View
struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()
    @EnvironmentObject var authService: AuthenticationService
    
    @State private var username = ""
    @State private var password = ""
    @State private var showingError = false
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Welcome Back")
                .font(.largeTitle)
                .bold()
            
            TextField("Username", text: $username)
                .textFieldStyle(.roundedBorder)
                .autocapitalization(.none)
            
            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)
            
            Button(action: login) {
                Text("Sign In")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }
            .disabled(viewModel.isLoading)
        }
        .padding()
        .alert("Login Failed", isPresented: $showingError) {
            Button("OK") { }
        }
    }
    
    private func login() {
        Task {
            do {
                try await authService.authenticate(
                    username: username,
                    password: password
                )
            } catch {
                showingError = true
            }
        }
    }
}

enum AuthError: Error {
    case invalidCredentials
    case networkError
    case tokenExpired
}

protocol APIClient {
    func get<T: Decodable>(_ endpoint: String) async throws -> T
    func post<T: Decodable, B: Encodable>(_ endpoint: String, body: B) async throws -> T
}