/**
 * Function
 * @param {Object} undefined={} - Description
 */
function test({ a = 1, b = { x: 1, y: 2 }, ...rest } = {}) {
  return { a, b, ...rest };
}
