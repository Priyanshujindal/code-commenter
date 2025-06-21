// examples/new-example.js

function greet(name) {
  return `Hello, ${name}!`;
}

const sum = (a, b) => a + b;

class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  login() {
    return `${this.name} logged in.`;
  }

  /**
   * Log out the user
   */
  logout() {
    return `${this.name} logged out.`;
  }
}

// Example usage
const user = new User('John', 30);
user.greet(); 