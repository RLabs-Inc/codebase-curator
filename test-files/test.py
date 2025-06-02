#!/usr/bin/env python3
"""Test Python file for semantic extraction."""

from typing import List, Optional
import asyncio
from dataclasses import dataclass

# Constants
API_KEY = "test-key"
MAX_RETRIES = 3

@dataclass
class User:
    """User model with authentication info."""
    id: int
    username: str
    email: str
    
    def __str__(self) -> str:
        return f"User({self.username})"

class AuthenticationService:
    """Handles user authentication and authorization."""
    
    def __init__(self, db_connection):
        self.db = db_connection
        self._cache = {}
    
    @property
    def is_connected(self) -> bool:
        """Check if database is connected."""
        return self.db is not None
    
    async def authenticate(self, username: str, password: str) -> Optional[User]:
        """Authenticate a user with credentials."""
        # Check cache first
        if username in self._cache:
            return self._cache[username]
        
        user = await self._fetch_user(username, password)
        if user:
            self._cache[username] = user
        return user
    
    async def _fetch_user(self, username: str, password: str) -> Optional[User]:
        """Internal method to fetch user from database."""
        # Simulate database query
        await asyncio.sleep(0.1)
        return User(1, username, f"{username}@example.com")
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password for storage."""
        return f"hashed_{password}"

def main():
    """Main entry point."""
    print("Authentication Service Example")

if __name__ == "__main__":
    main()