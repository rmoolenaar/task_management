'use strict';

var db = require('../models');

module.exports = function(router) {

    // GET API status.
    router.get('/', function(req, res) {
        res.json({status: "OK"});
    });

    /* GET current user. */
    router.get('/me', function(req, res) {
        db.User.find({ where: { email: req.user } })
        .then(function(result) {
            res.json(result);
        });
    });

    /* GET logout current user. */
    router.get('/logout', function(req, res) {
        req.logout();
        res.clearCookie('currentUser');
        req.session.destroy(function() {
            // Source: http://stackoverflow.com/questions/11575807/expressjs-doesnt-destroy-session
            res.clearCookie('connect.sid', { path: '/' });
            res.send('Ok');
        });
    });

	return router;
};
