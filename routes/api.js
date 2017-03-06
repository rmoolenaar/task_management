'use strict';

/**
* Main application routes
*/

module.exports = function(app) {

    var express = require('express');
	var router = express.Router({mergeParams: true});

    // Make sure all services under '/api' are authenticated AND not cached AND load the user account
    router.use(function noCacheAndAuthenticate(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,HEAD');
        //
        if (req.tokenPayload) {
            req.user = req.tokenPayload.email;
            res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            res.header('Expires', '-1');
            res.header('Pragma', 'no-cache');
            return next();
        } else {
            if ('OPTIONS' == req.method) {
                return res.sendStatus(200);
            }
        }
        res.redirect(401, '/login');
    });

    // Generic calls (user related)
    app.use('/api/v1', require('./user_api')(router));

    // Entity based API calls
    app.use('/api/v1/tasks', require('./api/task')(app, router));
};
