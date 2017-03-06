'use strict';

/**
 * Controller for Task resource
 *
 * @param  {Object} app Express app
 * @return {Object}
 */
module.exports = function(app) {

	var TaskService = require('./task.service')(app);
	var TaskController = require('../base.controller')(TaskService);

	return TaskController;
};
