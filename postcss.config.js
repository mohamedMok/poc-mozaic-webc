const pluginList = require('@mozaic-ds/css-dev-tools/postcssPluginConfig')
const scssSyntax = require('postcss-scss')

module.exports = {
  syntax: scssSyntax,
  plugins: pluginList,
}
