var express = require('express');
var ejwt = require('express-jwt');
var jwt = require('jsonwebtoken');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var cfg = require("./config.js");

var app = express();

// Load database library + entity definitions
var db = require('./models');


// Authentication
var passport = require('passport')
, LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
    function(username, password, done) {
        db.User.find({ where: { email: username } })
        .then(function(user) {
            var info;

            if (user && user.isValidPassword(password)) {
                return done(null, username, {user: user.dataValues});
            }
            else {
                info = { message: 'Incorrect username or password' };
                if (user) {
                    info.user = user.dataValues;
                }
                return done(null, false, info);
            }
        })
        .catch(function(err) {
            console.error('user error', err.stack);
        });
    })
);

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(id, done) {
    done(null, id);
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public/www')));
app.use(passport.initialize());

app.use(ejwt({secret: cfg.jwtSecret, userProperty: 'tokenPayload'}).unless({path: ['/api/v1/login', /^\/apipublic\/.*/, '/cordova.js', /^\/build\/.*/]}));

var api = require('./routes/api')(app);
var api_public = require('./routes/api_public');

app.use('/apipublic/v1', api_public);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;

// Initialize ORM database component
db
    .sequelize
    .sync({ force: false })
    .then(function() {
        console.log('Starting server');
    })
    .catch(function(err) {
        console.error(err);
    }
);
