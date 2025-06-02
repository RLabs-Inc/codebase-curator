package auth

import (
    "context"
    "errors"
    "fmt"
    "sync"
    "time"
)

// Constants
const (
    MaxRetries = 3
    Timeout    = 30 * time.Second
)

// User represents an authenticated user
type User struct {
    ID       int
    Username string
    Email    string
}

// Authenticator defines the authentication interface
type Authenticator interface {
    Authenticate(ctx context.Context, username, password string) (*User, error)
    Logout(ctx context.Context, userID int) error
}

// AuthService implements the Authenticator interface
type AuthService struct {
    db    Database
    cache map[string]*User
    mu    sync.RWMutex
}

// NewAuthService creates a new authentication service
func NewAuthService(db Database) *AuthService {
    return &AuthService{
        db:    db,
        cache: make(map[string]*User),
    }
}

// Authenticate validates user credentials
func (s *AuthService) Authenticate(ctx context.Context, username, password string) (*User, error) {
    // Check cache first
    s.mu.RLock()
    if user, exists := s.cache[username]; exists {
        s.mu.RUnlock()
        return user, nil
    }
    s.mu.RUnlock()
    
    // Fetch from database
    user, err := s.fetchUser(ctx, username, password)
    if err != nil {
        return nil, fmt.Errorf("authentication failed: %w", err)
    }
    
    // Update cache
    s.mu.Lock()
    s.cache[username] = user
    s.mu.Unlock()
    
    return user, nil
}

// Logout removes user from cache
func (s *AuthService) Logout(ctx context.Context, userID int) error {
    // Implementation here
    return nil
}

// fetchUser retrieves user from database
func (s *AuthService) fetchUser(ctx context.Context, username, password string) (*User, error) {
    // Simulate database query
    return &User{
        ID:       1,
        Username: username,
        Email:    username + "@example.com",
    }, nil
}

// Database interface
type Database interface {
    Query(ctx context.Context, query string, args ...interface{}) error
}

// HashPassword creates a secure hash of the password
func HashPassword(password string) string {
    return fmt.Sprintf("hashed_%s", password)
}