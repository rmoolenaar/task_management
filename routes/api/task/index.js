'use strict';

module.exports = function(app, router) {

	var db = require('../../../models');
	var controller = require('./task.controller')(app);

	// basic CRUD routes
	router.all('/tasks*', function(req, res, next) {
		db.User.find({ where: { email: req.user } })
        .then(function(user) {
			req.query.user_id = user.id;
			req.params.user_id = user.id;
			req.body.user_id = user.id;
            next();
        })
        .catch(function(err) {
			controller.handleError(err, res);
        })
	});
	router.get('/tasks', controller.index);
	router.get('/tasks/count', controller.count);
	router.get('/tasks/search', controller.search);
	router.get('/tasks/:id', controller.show);
	router.post('/tasks', controller.create);
	router.post('/tasks/:id', controller.update);
	router.delete('/tasks/:id', controller.delete);

	return router;
};
