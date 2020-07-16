'use strict'

process.env.BABEL_ENV = 'renderer'

const path = require('path')
const { dependencies, version } = require('../package.json')
const webpack = require('webpack')

const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const HtmlWebpackPlugin = require('html-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const GitRevisionPlugin = require('git-revision-webpack-plugin')

const IgnoreNotFoundExportPlugin = require('./plugins/IgnoreNotFoundExport')

const gitRevisionPlugin = new GitRevisionPlugin()
const gitRevision = {
  'VERSION': gitRevisionPlugin.version(),
  'COMMITHASH': gitRevisionPlugin.commithash(),
  'BRANCH': gitRevisionPlugin.branch(),
}

let whiteListedModules = ['vue']

const entries = [
  {
    name: 'main',
    path: '../src/gm/views/main.ts'
  },
]

function generateEntries () {
  return {
    points: entries.map((entry) => {
      return {
        [entry.name]: path.resolve(__dirname, entry.path)
      }
    }),
    html: entries.map((entry) => {
      return new HtmlWebpackPlugin({
        filename: `${entry.name}.html`,
        template: path.resolve(__dirname, `../src/gm/index.ejs`),
        chunks: [entry.name],
        minify: {
          collapseWhitespace: false,
          removeAttributeQuotes: true,
          removeComments: true
        },
        nodeModules: process.env.NODE_ENV !== 'production'
          ? path.resolve(__dirname, '../node_modules')
          : false
      })
    })
  }
}

const { points, html } = generateEntries()

const objectEntryPoints = Object.create({})

for (let i = 0; i <= points.length; i += 1) {
  for (let key in points[i]) {
    objectEntryPoints[key] = points[i][key]
  }
}

let rendererConfig = {
  devtool: false,
  stats: {
    warnings: false
  },
  entry: {
   ...objectEntryPoints,
  },
  externals: [
    ...Object.keys(dependencies || {}).filter(d => !whiteListedModules.includes(d))
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'awesome-typescript-loader',
          options: {
            transpileOnly: true,
            silent: true,
            useCache: true,
          }
        },
        exclude: [
          /node_modules/,
        ]
      },
      {
        test: /\.(js|vue)$/,
        enforce: 'pre',
        exclude: /node_modules/,
        use: {
          loader: 'eslint-loader',
          options: {
            formatter: require('eslint-friendly-formatter')
          }
        }
      },
      {
        test: /\.scss$/,
        use: ['vue-style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.sass$/,
        use: ['vue-style-loader', 'css-loader', 'sass-loader?indentedSyntax']
      },
      {
        test: /\.less$/,
        use: ['vue-style-loader', 'css-loader', 'less-loader']
      },
      {
        test: /\.css$/,
        use: ['vue-style-loader', 'css-loader']
      },
      {
        test: /\.html$/,
        use: 'vue-html-loader'
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      },
      {
        test: /\.vue$/,
        use: {
          loader: 'vue-loader',
          options: {
            extractCSS: process.env.NODE_ENV === 'production',
            loaders: {
              sass: 'vue-style-loader!css-loader!sass-loader?indentedSyntax=1',
              scss: 'vue-style-loader!css-loader!sass-loader',
              less: 'vue-style-loader!css-loader!less-loader'
            }
          }
        }
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        use: {
          loader: 'url-loader',
          query: {
            limit: 10000,
            name: 'imgs/[name]--[folder].[ext]'
          }
        }
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: 'media/[name]--[folder].[ext]'
        }
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: {
          loader: 'url-loader',
          query: {
            limit: 10000,
            name: 'fonts/[name]--[folder].[ext]'
          }
        }
      }
    ]
  },
  node: {
    __dirname: process.env.NODE_ENV !== 'production',
    __filename: process.env.NODE_ENV !== 'production'
  },
  plugins: [
    new IgnoreNotFoundExportPlugin(),
    new VueLoaderPlugin(),

    new MiniCssExtractPlugin({ filename: 'styles.css' }),

    ...html,

    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      'process.env.APP_VERSION': JSON.stringify(version),
      'process.env.GIT_VERSION': JSON.stringify(gitRevision.VERSION),
    }),
  ],
  output: {
    filename: '[name]/index.js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '../dist/electron/')
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, '../src'),
      'vue$': 'vue/dist/vue.esm.js',
    },
    extensions: ['.js', '.vue', '.json', '.css', '.node', '.tsx', '.ts', '.js']
  },
  target: 'electron-renderer'
}

/**
 * Adjust rendererConfig for development settings
 */
if (process.env.NODE_ENV !== 'production') {
  rendererConfig.plugins.push(
    new webpack.DefinePlugin({
      '__static': `"${ path.join(__dirname, '../static').replace(/\\/g, '\\\\') }"`
    })
  )
}

/**
 * Adjust rendererConfig for production settings
 */
if (process.env.NODE_ENV === 'production') {
  rendererConfig.devtool = ''

  rendererConfig.plugins.push(
    new CopyWebpackPlugin([
      {
        from: path.join(__dirname, '../static'),
        to: path.join(__dirname, '../dist/electron/static'),
        ignore: ['.*']
      }
    ]),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': '"production"'
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  )
}

module.exports = rendererConfig
