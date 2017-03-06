'use strict';

/**
 * module for base controller which handles API access
 *
 * @param  {Object} Service service which handles datastore access for Model
 * @return {Object}         base controller which handles API routes
 */
module.exports = function(Service) {

	var httpStatus = {
		200: 'OK',
		201: 'Created',
		400: 'Bad request',
		404: 'Not found',
		409: 'Conflict',
		422: 'Unprocessable Entity',
		500: 'Server error'
	};

	/**
	 * Handle error by returning descriptive message and HTTP status code
	 *
	 * @param  {Object} err error object
	 * @param  {Object} res response object
	 */
	var handleError = function(err, res) {
		var status;
		var errorObj = {};
		var errorType = err.name ? err.name : err.type;

		if(err.stack) console.error('error', err.stack);
		else console.error('error', err);

		switch(errorType) {
			case 'Field error':
			case 'Parsing error':
				status = 400;
				break;
			case 'NotFoundError':
				status = 404;
				break;
			case 'SequelizeUniqueConstraintError':
				status = 409;
				break;
			case 'SequelizeValidationError':
				status = 422;
				break;
			default:
				status = 500;
				errorObj.message = 'Server error';
		}

		errorObj.status = httpStatus[status];
		errorObj.statusCode = status;
		if(status !== 500) errorObj.message = err.message;

		if(err.errors) {
			console.log('errors:', err.errors);
			errorObj.developerMessage = err.errors.map(function(error) {
				var e = {
					message: error.message,
					type: error.type,
					field: error.path
				};
				if(error.value) e.illegalValue = error.value;

				return e;
			});
		}
		else if(err.type && err.path) {
			errorObj.developerMessage = {
				message: err.message,
				type: err.type,
				field: err.path,
				illegalValue: err.value
			};
		}

		res.status(status).json(errorObj);
	};

	/**
	 * Return 404 when resource(s) not found
	 *
	 * @param  {Object} res response object
	 */
	var handleNotFound = function(res) {
		handleError({name: 'NotFoundError', message: 'Not found'}, res);
	};

	/**
	 * Return base URL for current request
	 *
	 * @param  {Object} req request object
	 * @return {String}
	 */
	var getBaseUrl = function(req) {
		// @todo: include version (/v1) in x-forwarded-host
		if (req.headers['x-forwarded-host']) {
			return req.headers['x-forwarded-proto'] + '://' + req.headers['x-forwarded-host'];
		} else {
			return 'http://' + req.headers.host;
		}
	};

	/**
	 * Return full URL for current request
	 *
	 * @param  {Object} req request object
	 * @return {String}
	 */
	var getFullUrl = function(req) {
		return getBaseUrl(req) + req.originalUrl.replace('/v1', '');
	};

	/**
	 * Returns the navigation links as an object holding links as properties "first", "prev", "next" and "last"
	 * based on limit, offset and number of results
	 *
	 * @param  {Number} offset 	starting index
	 * @param  {Number} limit  	number of results to show
	 * @param  {Number} count  	total number of results
	 * @param  {Object} request
	 * @return {Object}
	 */
	var getNavigationLinks = function(offset, limit, count, req) {
		var prev;
		var next;
		var links = {};
		var fullUrl = getFullUrl(req).split('?').shift();

		if(offset === 0) next = offset + limit;
		else {
			prev = offset - limit >= 0 ? offset - limit : 0;
			if(offset + limit <= count) next = offset + limit;
		}
		var last = Math.floor(count/limit) * limit;

		links.first = {href: fullUrl + '?limit=' + limit + '&offset=0', limit: limit, offset: 0};
		links.prev = prev !== undefined ? {href: fullUrl + '?limit=' + limit + '&offset=' + prev, limit: limit, offset: prev} : null;
		links.next = next !== undefined ? {href: fullUrl + '?limit=' + limit + '&offset=' + next, limit: limit, offset: next} : null;
		links.last = {href: fullUrl + '?limit=' + limit + '&offset=' + last, limit: limit, offset: last};

		return links;
	};

	/**
	 * Merge two objects
	 *
	 * @param  {Object} a object that properties get merged into
	 * @param  {Object} b object whose properties are merged
	 * @return {Object}   merged object
	 */
	var merge = function(a, b) {
		for(var prop in b) {
			a[prop] = b[prop];
		}
		return a;
	};

	/**
	 * Add links to associations to resource
	 *
	 * @param {Object} resource
	 * @param {String} expand   string with associations to expand, comma delimited, can contain nested associations (resource1.resource2)
	 */
	var addAssociationLinks = function(resource, expand) {
		// resource has associated subresources
		if(resource.hasAssociations()) {
			var assocs = resource.getAssociations();

			Object.keys(assocs).forEach(function(assoc) {
				// if property on resource with the name of the subresource is an array
				// it means the subresource is expanded, add href to each resource in the array of subresources
				if(Array.isArray(resource.getDataValue(assoc))) {
					resource.setDataValue(assoc, resource.getDataValue(assoc).map(function(subResource) {
						subResource.setSelfLink(resource.baseUrl);
						subResource.baseUrl = resource.baseUrl;

						return addAssociationLinks(subResource, expand);
					}));
				}
				// subresource is not expanded, add a link to this subresource
				else if(!expand || expand && expand.indexOf(assoc) === -1) {
					var link;

					// if associationType is "BelongsTo" it means the association is the owner of this resource
					// and thus the link to the association is not relative to this resource
					if(assocs[assoc].associationType === 'BelongsTo') {
						link = resource.baseUrl + '/' + assocs[assoc].target.getPluralName() + '/' + resource[assocs[assoc].foreignKey];
					}
					else link = resource.getDataValue('link').href + '/' + assoc;

					resource.setDataValue(assoc, {
						href: link
					});
				}
			});
		}
		return resource;
	};

	/**
	 * Returns response object with properties:
	 *
	 * - status: 		http status phrase
	 * - statusCode: 	http status code
	 * - href: 			URL of request
	 * - total: 		total numer of results (in case of returned collection)
	 * - limit: 		number of results returned (in case of returned collection)
	 * 					equal to default limit of application or "limit" specified in url
	 * - criteria: 		URL parameters (if any)
	 * - items: 		array with collection of resources (in case of returned collection)
	 * - links: 		object with links to first, last, previous and next page (in case of returned collection and when only "offset" or both "offset" and "limit" are specified)
	 * - resource properties in case of a single resource (not a collection of resources with one item)
	 *
	 * @param  {Object} 		req  Request object
	 * @param  {Object} 		data returned data from service
	 * @param  {Number|null} 	code http status code, 200 if not specified
	 * @return {Object}
	 */
	var buildResponse = function(req, data, code) {
		var offset;
		var limit;
		var response = {};
		var statusCode = code || 200;
		var criteria = req.query;

		// parse offset and limit if present in request parameters
		// when limit is not specified it defaults to application limit
		if('offset' in criteria) offset = parseInt(criteria.offset, 10);
		if('limit' in criteria) limit = parseInt(criteria.limit, 10);
		else limit = Service.getLimit();

		// add status, status code and link to url
		response.status = httpStatus[statusCode];
		response.statusCode = statusCode;
		response.href = getFullUrl(req);

		// add total number of results and limit (in case of resource collection)
		if(data.count !== undefined) response.total = data.count;
		if(limit !== undefined && data.rows !== undefined)	response.limit = limit;

		// add url parameters to criteria field (if any)
		if(Object.keys(criteria).length) response.criteria = criteria;

		// add resource collection to items field
		if(data.rows !== undefined) {

			// only add links when no aggregation functions have been specified (in which case there is a single result)
			if(!Service.hasAggregateFunctions(criteria)) {
				response.items = data.rows.map(function(resource) {
					// add self link
					resource.setSelfLink(getBaseUrl(req));
					resource.baseUrl = getBaseUrl(req);

					// recursively add links to associated subresources
					resource = addAssociationLinks(resource, criteria.expand);
					return resource;
				});
			}
			// else response.data = data.rows;
			else {
				var values = data.rows[0].dataValues;
				for(var prop in values) {
					response[prop] = values[prop];
				}
			}
		}
		else {
			if(data.hasOwnProperty('dataValues')) {

				// add self link

				data.setSelfLink(getBaseUrl(req));
				data.baseUrl = getBaseUrl(req);

				// recursively add links to associated subresources
				data = addAssociationLinks(data, criteria.expand);

				// add resource properties to response
				data = data.get({plain: true});
			}
			response.item = {};
			for(var prop in data) {
				response[prop] = data[prop];
				response.item[prop] = data[prop];
			}
		}

		// add navigation links to response when offset and limit are defined
		if(offset !== undefined && limit !== undefined) {
			response.links = getNavigationLinks(offset, limit, data.count, req);
		}

		return response;
	};

	/**
	 * Base controller which handles API routes
	 *
	 * @type {Object}
	 */
	var BaseController = {

		count: function(req, res) {
			// merge query parameters and URL parameters from any parent routes
			// this turns a route like:
			//
			// /parent/:parent_id/children
			//
			// into:
			//
			// /children?parent_id=:parent_id
			//
			// so the same controller can be used for both routes
			var criteria = merge(req.query, req.params);

			var defaults = {};
			Service.count(criteria, defaults)
			.then(function(result) {
				if(result) res.json(buildResponse(req, {count: result}));
				else handleNotFound(res);
			})
			.catch(function(err) {
				handleError(err, res);
			});
		},

		search: function(req, res) {
			// merge query parameters and URL parameters from any parent routes
			// this turns a route like:
			//
			// /parent/:parent_id/children
			//
			// into:
			//
			// /children?parent_id=:parent_id
			//
			// so the same controller can be used for both routes
			var criteria = merge(req.query, req.params);

			var defaults = {};

			Service.search(criteria, defaults)
			.then(function(result) {
				if(result && result.rows.length) res.json(buildResponse(req, result));
				else handleNotFound(res);
			})
			.catch(function(err) {
				handleError(err, res);
			});
		},

		/**
		 * Get collection of resources, optionally filtered by criteria
		 *
		 * @param  {Object} req
		 * @param  {Object} res
		 */
		index: function(req, res) {
			// merge query parameters and URL parameters from any parent routes
			// this turns a route like:
			//
			// /parent/:parent_id/children
			//
			// into:
			//
			// /children?parent_id=:parent_id
			//
			// so the same controller can be used for both routes
			var criteria = merge(req.query, req.params);

			var defaults = {};

			Service.index(criteria, defaults)
			.then(function(result) {
				if(result && result.rows.length) {
					res.json(buildResponse(req, result));
				}
				else handleNotFound(res);
			})
			.catch(function(err) {
				handleError(err, res);
			});
		},

		/**
		 * Get single resource
		 *
		 * @param  {Object} req
		 * @param  {Object} res
		 */
		show: function(req, res) {
			var id = req.params.id;
			var criteria = req.query || null;

			Service.show(id, criteria)
			.then(function(resource) {
				if(resource) res.json(buildResponse(req, resource));
				else handleNotFound(res);
			})
			.catch(function(err) {
				handleError(err, res);
			});
		},

		/**
		 * Create resource
		 *
		 * @param  {Object} req
		 * @param  {Object} res
		 */
		create: function(req, res) {
			var model = req.body;

			Service.create(model)
			.then(function(result) {
				// if body=false is specified in query do not return the created resource
				var noReturn = 'body' in req.query && req.query.body === 'false';

				if(noReturn) res.status(201).send();
				else res.status(201).json(result);
			})
			.catch(function(err) {
				handleError(err, res);
			});
		},

		/**
		 * Save resource
		 *
		 * @param  {Object} req
		 * @param  {Object} res
		 */
		update: function(req, res) {
			var id = req.params.id;
			var model = req.body;
			req.query.id = id;

			// if body=false is specified in query do not return the saved resource
			var noReturn = 'body' in req.query && req.query.body === 'false';

			Service.update(req.query, model, noReturn)
			.then(function(result) {
				if(Array.isArray(result)) result = {affectedRows: result[0]};

				res.json(buildResponse(req, result));
			})
			.catch(function(err) {
				handleError(err, res);
			});
		},

		/**
		 * delete model
		 *
		 * @param  {Object} req
		 * @param  {Object} res
		 */
		delete: function(req, res) {
			var id = req.params.id;
			req.query.id = id;

			Service.delete(req.query)
			.then(function() {
				res.status(204).send();
			})
			.catch(function(err) {
				handleError(err, res);
			});
		},

		handleError: handleError,
		buildResponse: buildResponse
	};

	return BaseController;
};
