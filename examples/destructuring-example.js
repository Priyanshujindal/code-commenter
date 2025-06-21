// This function uses deeply destructured parameters

// TODO: Document what processUserData does
/**
 * processUserData
 * @param {Object} param1 - Object parameter
 * @param {any} param1.id - Property 'param1.id'
 * @param {any} param1.profile.name - Property 'param1.profile.name'
 * @param {any} param1.profile.contact.email - Property 'param1.profile.contact.email'
 * @param {any} param1.profile.contact.phone - Property 'param1.profile.contact.phone'
 * @param {string} param1.settings.theme="dark" - Property 'param1.settings.theme'
 * @param {boolean} param1.settings.notifications.enabled=true - Property 'param1.settings.notifications.enabled'
 * @param {...*} rest - Rest property
 * @param {...*} userRest - Rest property
 * @returns {any} Return value
 */
function processUserData({
  id,
  profile: {
    name,
    contact: { email, phone },
  },
  settings: { theme = "dark", notifications: { enabled = true, ...rest } },
  ...userRest
}) {
  console.log(id, name, email, phone, theme, enabled, rest, userRest);
}

// Another example with nested defaults
const
// TODO: Document what configure does
/**
 * configure
 * @param {Object} param1 - Object parameter
 * @param {number} param1.options.port=3000 - Property 'param1.options.port'
 * @param {boolean} param1.options.env.production=false - Property 'param1.options.env.production'
 * @returns {any} Return value
 */
configure = ({
  options: {
    port = 3000,
    env: { production = false },
  },
}) => {
  // function body
};