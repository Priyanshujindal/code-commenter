// This is an example file to demonstrate the code-commenter tool

// A simple function that adds two numbers
function add(a, b) {
  return a + b;
}

// Function with parameters but no return type documented
function greet(name, age) {
  return `Hello, ${name}! You are ${age} years old.`;
}

// This function is already well-documented
/**
 * Calculates the factorial of a number
 * @param {number} n - The number to calculate factorial for
 * @returns {number} The factorial of n
 */
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// Arrow function assigned to a variable
const multiply = (a, b) => a * b;

// Object with methods
const calculator = {
  // Method with missing documentation
  divide(a, b) {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  },

  // Well-documented method
  /**
   * Raises a number to a power
   * @param {number} base - The base number
   * @param {number} exponent - The exponent
   * @returns {number} The result of base^exponent
   */
  power: function(base, exponent) {
    return Math.pow(base, exponent);
  }
};

// Class with methods
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  // Method with missing documentation
  getProfile() {
    return {
      name: this.name,
      email: this.email,
      joined: new Date().toISOString()
    };
  }

  // Well-documented method
  /**
   * Sends a welcome email to the user
   * @param {string} message - The welcome message
   * @returns {Promise<boolean>} True if email was sent successfully
   */
  async sendWelcomeEmail(message) {
    // Implementation would go here
    return true;
  }
}

// Function with complex parameters
function processUserData(users, options = {}) {
  const { filter, sortBy, limit } = {
    filter: () => true,
    sortBy: 'name',
    limit: 10,
    ...options
  };

  return users
    .filter(filter)
    .sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : -1))
    .slice(0, limit);
}

// Example of a higher-order function
function createLogger(prefix) {
  return function(...args) {
    console.log(`[${prefix}]`, ...args);
  };
}

// Function that uses callbacks
function fetchData(url, callback) {
  // Simulate async operation
  setTimeout(() => {
    callback(null, { data: 'Sample data' });
  }, 100);
}

// Function that returns a promise
function fetchDataAsync(url) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: 'Sample async data' });
    }, 100);
  });
}

// Async/await example
async function getUserPosts(userId) {
  try {
    const response = await fetchDataAsync(`/api/users/${userId}/posts`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch user posts:', error);
    throw error;
  }
}

// Exporting functions for module usage
module.exports = {
  add,
  greet,
  factorial,
  multiply,
  calculator,
  User,
  processUserData,
  createLogger,
  fetchData,
  fetchDataAsync,
  getUserPosts
};
