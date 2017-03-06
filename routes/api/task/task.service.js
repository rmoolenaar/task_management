'use strict';

var db = require('../../../models');

/**
 * Service to handle datastore access for Task resource
 *
 * @param  {Object} app Express app
 * @return {Object}
 */
module.exports = function(app) {

	var Task = db.Task;
	var TaskService = Object.create(require('../base.service')(app));

	TaskService.setModel(Task);

	return TaskService;
};
