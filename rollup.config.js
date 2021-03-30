import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import jsonPlugin from '@rollup/plugin-json'
import { postcss } from 'svelte-preprocess'

const pluginList = require('@mozaic-ds/css-dev-tools/postcssPluginConfig')
const scssSyntax = require('postcss-scss')

export default {
  input: 'src/main.js',
  output: {
    file: 'public/bundle.js',
    format: 'esm'
  },
  plugins: [
    jsonPlugin(),
    // sveltePreprocess({
    //     postcss: true
    // }),
    svelte({
      // You can restrict which files are compiled
      // using `include` and `exclude`
      include: 'src/stories/*.svelte',

      // Optionally, preprocess components with svelte.preprocess:
      // https://svelte.dev/docs#svelte_preprocess
      preprocess: [
        postcss({
            syntax: scssSyntax,
            plugins: pluginList,
        })
      ],

      // Emit CSS as "files" for other plugins to process. default is true
      emitCss: false,

      // Warnings are normally passed straight to Rollup. You can
      // optionally handle them here, for example to squelch
      // warnings with a particular code
    //   onwarn: (warning, handler) => {
    //     // e.g. don't warn on <marquee> elements, cos they're cool
    //     if (warning.code === 'a11y-distracting-elements') return;

    //     // let Rollup handle all other warnings normally
    //     handler(warning);
    //   },

      // You can pass any of the Svelte compiler options
      compilerOptions: {

        // By default, the client-side compiler is used. You
        // can also use the server-side rendering compiler
        // generate: 'ssr',

        // ensure that extra attributes are added to head
        // elements for hydration (used with generate: 'ssr')
        // hydratable: true,

        // You can optionally set 'customElement' to 'true' to compile
        // your components to custom elements (aka web elements)
        customElement: true
      }
    }),
    // see NOTICE below
    resolve({ browser: true }),
    // ...
  ]
}