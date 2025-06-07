// Test file for development markers

// TODO: Implement user authentication
function authenticateUser() {
  // FIXME: Security vulnerability - passwords stored in plain text
  return false;
}

// HACK: Temporary workaround for database connection issues
const retryConnection = () => {
  // XXX: This should be refactored when we upgrade the DB driver
  console.log('retrying...');
};

class UserService {
  // BUG: Memory leak when processing large user lists
  processUsers() {
    // OPTIMIZE: This O(n²) algorithm should be improved
    return [];
  }
  
  // REFACTOR: Split this method into smaller functions
  handleUserData() {
    // NOTE: Keep this synchronized with the API documentation
    // REVIEW: Check if this logic is still needed after v2.0
    return null;
  }
  
  // DEPRECATED: Use newMethod() instead
  oldMethod() {
    // WORKAROUND: Handles edge case in legacy systems
    // TEMP: Remove after migration is complete
    // KLUDGE: Not proud of this but it works
    // SMELL: This indicates a design problem
    return 'legacy';
  }
}

/*
 * FIXME: Multi-line comment with development marker
 * This entire module needs to be reviewed
 */

/**
 * @deprecated Since version 2.0
 * TODO: Remove in version 3.0
 * NOTE: Migration guide available in docs
 */
export function deprecatedFunction() {
  return null;
}