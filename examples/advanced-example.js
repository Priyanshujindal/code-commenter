// examples/advanced-example.js

// Top-level function with destructuring and default params
function processOrder(
  { id, items = [], user = {} },
  status = "pending",
  ...rest
) {
  function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price * (item.qty ?? 1), 0);
  }
  const total = calculateTotal(items);
  return { id, total, status, ...rest };
}

// Arrow function with default and rest
const logMessages = (level = "info", ...messages) => {
  messages.forEach((msg) => console.log(`[${level}]`, msg));
};

// Async function
async function fetchData(url, { method = "GET", headers = {} } = {}) {
  const response = await fetch(url, { method, headers });
  return response.json();
}

// Class with static, async, getter/setter, and method
class Product {
  static fromJSON(json) {
    return new Product(json.name, json.price);
  }

  constructor(name, price) {
    this.name = name;
    this.price = price;
  }

  async updatePrice(newPrice) {
    this.price = await Promise.resolve(newPrice);
    return this.price;
  }

  get info() {
    return `${this.name}: $${this.price}`;
  }

  set discount(percent) {
    this.price = this.price * (1 - percent / 100);
  }
}

// Nested function and closure
function outer(a) {
  return function inner(b) {
    return a + b;
  };
}
