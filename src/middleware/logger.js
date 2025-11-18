// Middleware para logging de requisições
function requestLogger(req, res, next) {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
}

module.exports = requestLogger;

