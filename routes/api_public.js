var express = require('express');
var db = require('../models');
var cfg = require("../config.js");
var passport = require('passport');
var crypto = require('crypto');
var router = express.Router();
var jwt = require("jsonwebtoken");
var mailer = require("../modules/mailer");


// Make sure all services under '/apipublic' are not cached
router.use(function noCacheAndAuthenticate(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,HEAD');
    return next();
});


// GET API status.
router.get('/', function(req, res, next) {
    res.json({status: "OK"});
});

// Callback function to check if the user is authenticated
var authCallback = function(req, res, next) {
    return passport.authenticate('local', function(err, user, info) {
        if (!user) {
            req.logout();
            res.status(401).send('Unauthorized');
        } else {
            // when login return user, otherwise to next middleware
            if (req.url === '/login') {
                req.logIn(user, function(err) {
                    if (err) {
                        return next(err);
                    }
                    return res.json({ token: jwt.sign({email: user}, cfg.jwtSecret) });
                });
            }
        }
    })(req, res, next);
};

// Example:
// curl -v --data "username=remco@javadb.nl&password=testpwd\!" http://localhost:3000/apipublic/v1/login
// curl -v -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InJlbWNvQGphdmFkYi5ubCIsImlhdCI6MTQ4ODI4NTEwOH0.fPEdxUC5qLEh-hfLOVmK3mbX-LcYg2NB_1ZdDxuPDF8" http://localhost:3000/api/v1/

// Authenticate user
router.post('/login', [authCallback]);

/* Register new user. */
router.post('/register', function(req, res, next) {
    var user_in = req.body;
    db.User.find({ where: { email: user_in.username } })
    .then(function(user) {
        if (user && user.id) {
            // User already exists --> return error
            res.status(409).send('Exists');
        } else {
            if (user_in.username && user_in.password && user_in.name) {
                var newuser = {
                    email: user_in.username,
                    password: user_in.password,
                    name: user_in.name,
                    level: 100 /* Only create regular users via the API */
                };
                db.User.create(newuser).then(function(newuser) {
                    res.json(newuser)
                }).catch(function(err) {
                    console.log(err);
                    res.json({ status: 'ERROR', error: err })
                });
            } else {
                res.status(400).send('Missing data');
            }
        }
    })
    .catch(function(err) {
        console.error('user error', err.stack);
    });
});

/* Send new password. */
router.post('/resetpassword', function(req, res, next) {
    var username = req.body.username;
    db.User.find({ where: { email: username } })
    .then(function(user) {
        var password = random(8);
        var updAccount = { password: password };
        user.update(updAccount).then(function() {
            mailer.sendmail(username, 'A new password for task management', 'Hi,\n\nYour new password for the task management applications is: ' + password + '\n\nThe Task Management team');
        });
    })
    .catch(function(err) {
        console.error('user error', err.stack);
    });
    res.json(req.body);
});

function random(howMany, chars) {
    chars = chars
        || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
    var rnd = crypto.randomBytes(howMany)
        , value = new Array(howMany)
        , len = chars.length;

    for (var i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len];
    };

    return value.join('');
}

module.exports = router;
