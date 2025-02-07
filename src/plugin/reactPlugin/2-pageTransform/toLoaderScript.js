const { stringify } = require('javascript-stringify')
const toClientImportStatement = require('./toClientImportStatement')
const toUnixPath = require('../../../utils/toUnixPath')

/**
 * Generate the `<script>` necessary to load a Component into a given mount point
 * @typedef LoaderScriptParams
 * @property {string} componentPath - path to the component itself, used for the import statement
 * @property {string} id - the unique id for a given mount point
 * @property {'eager' | 'lazy'} hydrate - which hydration loader to use
 * @property {Record<string, any>} props - data used when hydrating the component
 * @param {LoaderScriptParams}
 * @returns {string} String of HTML to run loader in the client
 */
module.exports = function toLoaderScript({ componentPath, hydrate, id, props = {} }) {
  // TODO: abstract "props" to some other file, instead of stringifying in-place
  // We could be generating identical, large prop blobs
  const componentImportStatement = JSON.stringify(toUnixPath(componentPath))
  if (hydrate === 'eager') {
    return `<script type="module">
    import Component from ${componentImportStatement};
    import eagerLoader from ${toClientImportStatement('_eager-loader.js')};
  
    eagerLoader({ 
      id: "${id}",
      Component,
      props: ${stringify(props)},
    });
  </script>`
  } else if (hydrate === 'lazy') {
    return `<script type="module">
    import lazyLoader from ${toClientImportStatement('_lazy-loader.js')};
  
    lazyLoader({ 
      id: "${id}",
      componentImporter: async () => await import(${componentImportStatement}),
      props: ${stringify(props)},
    });
  </script>`
  } else {
    throw 'Unsupported loader'
  }
}
