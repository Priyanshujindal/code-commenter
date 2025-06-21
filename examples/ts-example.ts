// examples/ts-example.ts

function add(a: number, b: number): number {
  return a + b;
}

const multiply = (x: number, y: number): number => x * y;

class User {
  constructor(
    public name: string,
    private age: number,
  ) {}

  get info(): string {
    return `${this.name} (${this.age})`;
  }

  set nickname(nick: string) {
    this.name = nick;
  }
}

// Generic function with union and default parameter
function identity<T>(value: T | null = null): T | null {
  return value;
}

// Function with intersection type and optional parameter
function merge<A, B>(a: A, b?: B): A & B {
  return { ...a, ...(b || {}) } as A & B;
}

// Interface and type alias usage
interface Point {
  x: number;
  y: number;
  label?: string;
}
type Shape = Point & { area: () => number };

// Function using interface and type alias
function describeShape(shape: Shape): string {
  return `${shape.label ?? "Shape"} at (${shape.x},${shape.y}) with area ${shape.area()}`;
}

// Arrow function with generic and default
const makeArray = <T = number>(len: number, value: T): T[] =>
  Array(len).fill(value);

// Class with generic, parameter property, and method
class Box<T> {
  constructor(public value: T) {}
  getValue(): T {
    return this.value;
  }
}
