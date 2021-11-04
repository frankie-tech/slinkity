/**
 * @typedef SlinkityConfigOptions
 * @property {{
 *  input: string;
 *  output: string;
 *  includes: string;
 *  layouts: string;
 * }} dir - paths to all significant directories, as specified in 11ty's "dir" documentation
 * @property {import('../cli/toViteSSR').ViteSSR | null} viteSSR - utility to import components as Node-friendly modules
 * @property {import('../main/defineConfig').UserSlinkityConfig} userSlinkityConfig - Slinkity config options (either from user config or defaults)
 * @property {import('browser-sync').Options} browserSyncOptions - Slinkity's own browser sync server for dev environments
 * @property {'dev' | 'prod'} environment - whether we want a dev server or a production build
 */

const browserSync = require('browser-sync')
const { relative, join } = require('path')
const toSlashesTrimmed = require('../utils/toSlashesTrimmed')
const { getResolvedAliases } = require('../cli/vite')
const { toComponentAttrStore } = require('./componentAttrStore')
const { toHydrationLoadersApplied } = require('./eleventy-config/toHydrationLoadersApplied')
const { applyViteHtmlTransform } = require('./vite-middleware/applyViteHtmlTransform')
const { applyEleventyConfig } = require('./eleventy-config')

// TODO: abstract based on renderer plugins configured
// https://github.com/slinkity/slinkity/issues/55
const extensions = [
  {
    extension: 'jsx',
    isTemplateFormat: true,
    isIgnoredFromIncludes: true,
  },
  {
    extension: 'css',
    isTemplateFormat: false,
    isIgnoredFromIncludes: true,
  },
  {
    extension: 'scss',
    isTemplateFormat: false,
    isIgnoredFromIncludes: true,
  },
]

function toEleventyIgnored(userEleventyIgnores, dir) {
  const defaultIgnoredExts = extensions
    .filter((entry) => entry.isIgnoredFromIncludes)
    .map((entry) => join(dir.input, dir.includes, `**/*.${entry.extension}`))
  return typeof userEleventyIgnores === 'function'
    ? userEleventyIgnores(defaultIgnoredExts)
    : userEleventyIgnores ?? defaultIgnoredExts
}

/**
 * @param {SlinkityConfigOptions} options - all Slinkity plugin options
 * @returns (eleventyConfig: Object) => Object - config we'll apply to the Eleventy object
 */
module.exports = function slinkityConfig({ userSlinkityConfig, ...options }) {
  const { dir, viteSSR, browserSyncOptions, environment } = options
  // TODO: ignore based on renderers (ex. ignore 'jsx' if the React renderer is applied)
  const eleventyIgnored = toEleventyIgnored(userSlinkityConfig.eleventyIgnores, dir)
  const componentAttrStore = toComponentAttrStore()
  const rendererMap = Object.fromEntries(
    userSlinkityConfig.renderers.map((renderer) => [renderer.name, renderer]),
  )

  return function (eleventyConfig) {
    // TODO: abstract this to "applyEleventyConfig"
    eleventyConfig.addTemplateFormats(
      extensions.filter((ext) => ext.isTemplateFormat).map((ext) => ext.extension),
    )
    for (const ignored of eleventyIgnored) {
      eleventyConfig.ignores.add(ignored)
    }
    // -------------------------------------------

    applyEleventyConfig(eleventyConfig, {
      viteSSR,
      componentAttrStore,
      renderers: userSlinkityConfig.renderers,
      resolvedImportAliases: getResolvedAliases(dir),
    })

    eleventyConfig.addTransform(
      'apply-react-hydration-loaders',
      async function (content, outputPath) {
        if (!outputPath.endsWith('.html')) return content

        const componentAttrs = componentAttrStore
          .getAllByPage(outputPath)
          // only get components that need hydration loaders
          .filter(({ hydrate }) => hydrate !== 'static')

        return await toHydrationLoadersApplied({
          content,
          componentAttrs,
          rendererMap,
          dir,
        })
      },
    )

    if (environment === 'dev') {
      const urlToOutputHtmlMap = {}

      browserSync.create()
      browserSync.init({
        ...browserSyncOptions,
        middleware: [
          async function viteTransformMiddleware(req, res, next) {
            const page = urlToOutputHtmlMap[toSlashesTrimmed(req.originalUrl)]
            if (page) {
              const { content, outputPath } = page
              res.write(
                await applyViteHtmlTransform(
                  { content, outputPath, componentAttrStore, rendererMap },
                  options,
                ),
              )
              res.end()
            } else {
              next()
            }
          },
          viteSSR.server.middlewares,
        ],
      })

      eleventyConfig.on('beforeBuild', () => {
        componentAttrStore.clear()
      })

      eleventyConfig.addTransform(
        'update-url-to-compiled-html-map',
        function (content, outputPath) {
          const relativePath = relative(dir.output, outputPath)
          const formattedAsUrl = toSlashesTrimmed(
            relativePath.replace(/.html$/, '').replace(/index$/, ''),
          )
          urlToOutputHtmlMap[formattedAsUrl] = {
            outputPath,
            content,
          }
          return content
        },
      )
    }

    if (environment === 'prod') {
      eleventyConfig.addTransform('apply-vite', async function (content, outputPath) {
        return await applyViteHtmlTransform(
          { content, outputPath, componentAttrStore, rendererMap },
          options,
        )
      })
    }
    return {}
  }
}
