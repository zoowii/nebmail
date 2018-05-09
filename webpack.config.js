const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './js/app.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: './app.bundle.js'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin()
  ]
};