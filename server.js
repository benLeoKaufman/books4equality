var express = require('express'),
    http = require('http'),
    path = require('path'),
    less = require('less-middleware'),
    engine = require('ejs-locals'),
    favicon = require('serve-favicon'),
    logger = require('./services/logger'),
    db = require('./services/db'),
    books = require('./services/books'),
    routes = require('./routes/index'),
    api = require('./routes/api'),
    config = require('./config'),
    admin = require('./routes/admin');

var app = express();

app.disable('x-powered-by');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.engine('ejs', engine);

app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(less(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(function populateLocals(req, res, next) {
    books.stats(function(err, stats) {
        if (err) {
            return next(err);
        }
        res.locals.stats = stats;
        res.locals.config = config;
        return next();
    });
});

app.use('/', routes);
app.use('/api', api);
app.use('/', admin);

app.use(function notFound(req, res, next) {
    var err = new Error('Resource not Found');
    err.status = 404;
    next(err);
});

app.use(function(err, req, res, next) {
    logger.warn(err);

    res.status(err.status || 500);

    if (req.xhr) {
        res.json({'error': err.message});
    } else {
        res.render('error', {
            message: err.message
        });
    }
});

db.connect(function(err) {
    if (err) {
        process.exit(1);
    }

    var server = http.createServer(app);
    var port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 3200;
    var host = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";

    server.listen(port, host, function() {
        logger.info('b4e listening on', server.address());
    });
});

process.on('SIGTERM', function() {
    logger.info('SIGTERM received, try ordered shutdown');
    server.close(function() {
        db.disconnect(function() {
            process.exit(0);
        });
    });
});
