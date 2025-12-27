const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const port = process.env.REACT_APP_WEATHER_LOG_PORT || process.env.WEATHER_LOG_PORT || '3031';
  app.use(
    '/__weatherlog',
    createProxyMiddleware({
      target: `http://localhost:${port}`,
      changeOrigin: true,
      pathRewrite: { '^/__weatherlog': '' },
      logLevel: 'silent'
    })
  );
};
