import { resolve } from 'node:path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';

/**
 * 所有 app 共用的 rspack 构建配置。
 *
 * 关键点：Nest CLI 的 rspack builder 不会自动读取 tsconfig 里的 `paths`，
 * 必须显式注入插件，否则 `@app/*` 别名在构建期会解析失败
 * （开发期 ts-node/vitest 正常，构建期报 Module not found）。
 */
export default {
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: resolve(process.cwd(), 'tsconfig.json'),
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: false,
  },
};
