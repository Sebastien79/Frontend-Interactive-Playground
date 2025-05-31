const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  // cache: false, // Disable Webpack cache
  mode: "development",
  entry: './src/index.tsx', // Change this to your entry point
  output: {
    filename: 'js/bundle.js', // Output filename
    path: path.resolve(__dirname, 'dist'), // Output folder
    publicPath: '/', // Ensure files are served correctly
    libraryTarget: 'system', // Output as SystemJS module
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@components': path.join(__dirname, 'src/components'),
      '@locales': path.join(__dirname, 'src/locales'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'esnext',
              sourceMap: true,
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
    ],
  },
  externals: {
    react: "React",
    "react-dom": "ReactDOM",
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/index.html', to: 'index.html' },
        { from: 'node_modules/systemjs/dist/system.js', to: 'vendor/systemjs/' },
        { from: 'node_modules/react/umd/react.development.js', to: 'vendor/react/' },
        { from: 'node_modules/react-dom/umd/react-dom.development.js', to: 'vendor/react-dom/' },
      ]
    })
  ],
  devServer: {
    static: path.join(__dirname, 'dist'), // Serve from 'dist'
    compress: true, // Enable gzip compression
    port: 8081, // Change as needed
    historyApiFallback: true, // Handle React Router
    headers: { "Access-Control-Allow-Origin": "*" },
    client: { webSocketURL: { hostname: "localhost" } },
    allowedHosts: "all",
  },
};
