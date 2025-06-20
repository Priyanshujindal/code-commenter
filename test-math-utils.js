// Math utility functions

/**
 * Adds two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}

// This function needs documentation
function subtract(a, b) {
  return a - b;
}

// Arrow function without documentation
const multiply = (a, b) => a * b;

// Class with methods
class Calculator {
  // This method has documentation
  /**
   * Divides two numbers
   * @param {number} a - Dividend
   * @param {number} b - Divisor
   * @returns {number} Result of division
   */
  divide(a, b) {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  }

  // This method needs documentation
  power(base, exponent) {
    return Math.pow(base, exponent);
  }
}

// Function with default parameters
function greet(name = 'stranger', greeting = 'Hello') {
  return `${greeting}, ${name}!`;
}

// Function with rest parameters
function sumAll(...numbers) {
  return numbers.reduce((sum, num) => sum + num, 0);
}

// Function with destructuring
function getFullName({ firstName, lastName }) {
  return `${firstName} ${lastName}`;
}

// Function that returns an object
function createUser(name, age) {
  return {
    name,
    age,
    isAdult: age >= 18
  };
}

// Async function
async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}

// Export all functions
module.exports = {
  add,
  subtract,
  multiply,
  Calculator,
  greet,
  sumAll,
  getFullName,
  createUser,
  fetchData
};
