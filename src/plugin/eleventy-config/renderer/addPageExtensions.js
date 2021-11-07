const { toMountPoint } = require('./toMountPoint')
const toFormattedDataForProps = require('../toFormattedDataForProps')
const { join } = require('path')

/**
 * @param {object} eleventyConfig
 * @typedef AddPageExtParams
 * @property {import('../../componentAttrStore').ComponentAttrStore} componentAttrStore
 * @property {import('../../../cli/toViteSSR').ViteSSR} viteSSR
 * @property {import('../../../cli/vite').ResolvedImportAliases} resolvedImportAliases
 * @property {import('../../../main/defineConfig').Renderer} renderer
 * @param {AddPageExtParams}
 */
module.exports.addPageExtensions = function (
  eleventyConfig,
  { componentAttrStore, viteSSR, resolvedImportAliases, renderer },
) {
  for (const extension of renderer.extensions) {
    eleventyConfig.addExtension(extension, {
      read: false,
      async getData(inputPath) {
        // const absInputPath = join(resolvedImportAliases.root, inputPath)
        // const loadedModule = await viteSSR.toCommonJSModule(absInputPath)
        // return await renderer
        //   .page({ loadedModule, eleventyConfig, extension })
        //   .getData(loadedModule)
        return {}
      },
      compile(_, inputPath) {
        return async function render(data) {
          const absInputPath = join(resolvedImportAliases.root, inputPath)
          // const loadedModule = await viteSSR.toCommonJSModule(absInputPath)
          // const { getProps, getHydrationMode, useFormatted11tyData } = await renderer.page({
          //   loadedModule,
          //   eleventyConfig,
          //   extension,
          // })

          const getProps = () => ({})
          const getHydrationMode = () => 'eager'
          const useFormatted11tyData = false

          const formattedData = useFormatted11tyData ? toFormattedDataForProps(data) : data
          const props = await getProps(formattedData)
          const hydrate = await getHydrationMode(data)

          const id = componentAttrStore.push({
            path: absInputPath,
            props,
            styleToFilePathMap: {},
            hydrate,
            pageOutputPath: data.page.outputPath,
            rendererName: renderer.name,
          })

          return toMountPoint({ id, hydrate })
        }
      },
    })
  }
}
