const { stringify } = require('javascript-stringify')
const { resolve } = require('path')
const toUnixPath = require('../../utils/toUnixPath')

function toClientImportStatement(relativePath) {
  // TODO: make this a true absolute path from the base of this module's build output
  return JSON.stringify(toUnixPath(resolve('../_client', relativePath)))
}

/**
 * Generate the `<script>` necessary to load a Component into a given mount point
 * @typedef LoaderScriptParams
 * @property {string} componentPath - path to the component itself, used for the import statement
 * @property {string} rendererPath - path to the component's render, as specified by the renderer.client
 * @property {string} id - the unique id for a given mount point
 * @property {'eager' | 'lazy'} hydrate - which hydration loader to use
 * @property {Record<string, any>} props - data used when hydrating the component
 * @param {LoaderScriptParams}
 * @returns {string} String of HTML to run loader in the client
 */
module.exports.toLoaderScript = function ({
  componentPath,
  rendererPath,
  hydrate,
  id,
  props = {},
}) {
  // TODO: abstract "props" to some other file, instead of stringifying in-place
  // We could be generating identical, large prop blobs
  const componentImportPath = JSON.stringify(toUnixPath(componentPath))
  const rendererImportPath = JSON.stringify(toUnixPath(rendererPath))
  if (hydrate === 'eager') {
    return `<script type="module">
    import loadedModule from ${componentImportPath};
    import eagerLoader from ${toClientImportStatement('_eager-loader.js')};
    import renderer from ${rendererImportPath}
  
    eagerLoader({ 
      id: "${id}",
      props: ${stringify(props)},
      loadedModule,
      renderer,
    });
  </script>`
  } else if (hydrate === 'lazy') {
    return `<script type="module">
    import lazyLoader from ${toClientImportStatement('_lazy-loader.js')};
  
    lazyLoader({ 
      id: "${id}",
      props: ${stringify(props)},
      toLoadedModule: async () => await import(${componentImportPath}),
      toRenderer: async () => await import(${rendererImportPath}),
    });
  </script>`
  } else {
    throw 'Unsupported loader'
  }
}
