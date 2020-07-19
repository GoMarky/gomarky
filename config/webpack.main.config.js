"use strict"

process.env.BABEL_ENV = "main"

const { join } = require("path")
const { dependencies, version } = require("../package.json")
const webpack = require("webpack")

const BabiliWebpackPlugin = require("babili-webpack-plugin")
const GitRevisionPlugin = require("git-revision-webpack-plugin")
const IgnoreNotFoundExportPlugin = require('./plugins/IgnoreNotFoundExport')

const gitRevisionPlugin = new GitRevisionPlugin()
const gitRevision = {
  "VERSION": gitRevisionPlugin.version(),
  "COMMITHASH": gitRevisionPlugin.commithash(),
  "BRANCH": gitRevisionPlugin.branch(),
}

let mainConfig = {
  entry: {
    main: join(__dirname, "../src/setup.ts"),
  },
  externals: [
    ...Object.keys(dependencies || {}),
  ],
  stats: {
    warnings: false,
  },
  module: {
    rules: [
      {
        test: /\.ts|\.tsx$/,
        use: {
          loader: "awesome-typescript-loader",
          options: {
            transpileOnly: true,
            silent: true,
            useCache: true,
          },
        },
        exclude: [
          /node_modules/,
        ],
      },
      {
        test: /\.(js)$/,
        enforce: "pre",
        exclude: /node_modules/,
        use: {
          loader: "eslint-loader",
          options: {
            formatter: require("eslint-friendly-formatter"),
          },
        },
      },
      {
        test: /\.js$/,
        use: "babel-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.node$/,
        use: "node-loader",
      },
    ],
  },
  node: {
    __dirname: process.env.NODE_ENV !== "production",
    __filename: process.env.NODE_ENV !== "production",
  },
  output: {
    filename: "[name].js",
    libraryTarget: "commonjs2",
    path: join(__dirname, "../dist/electron"),
  },
  plugins: [
    new IgnoreNotFoundExportPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      "process.env.APP_VERSION": JSON.stringify(version),
      "process.env.GIT_VERSION": JSON.stringify(gitRevision.VERSION),
    }),
  ],
  resolve: {
    extensions: [".js", ".json", ".node", ".tsx", ".ts", ".js"],
    alias: {
      "@": join(__dirname, "../src"),
    },
  },
  target: "electron-main",
}

/**
 * Adjust mainConfig for development settings
 */
if (process.env.NODE_ENV !== "production") {
  mainConfig.plugins.push(
    new webpack.DefinePlugin({
      "__static": `"${ join(__dirname, "../static").replace(/\\/g, "\\\\") }"`,
    }),
  )
}

/**
 * Adjust mainConfig for production settings
 */
if (process.env.NODE_ENV === "production") {
  mainConfig.plugins.push(
    new BabiliWebpackPlugin(),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": '"production"',
    }),
  )
}

module.exports = mainConfig
