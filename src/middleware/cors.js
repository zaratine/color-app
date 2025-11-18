// Middleware para CORS
function corsMiddleware(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
}

module.exports = corsMiddleware;

