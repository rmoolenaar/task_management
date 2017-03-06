'use strict';

var _ = require('lodash');
var async = require('async');
var db = require('../../models');

/**
 * Base service which handles datastore access
 *
 * @type {Object}
 */
module.exports = function(app) {

	var sequelize = db.sequelize;
	var aggFuncs = ['avg', 'sum'];
	var reservedParameters = ['limit', 'offset', 'order', 'group', 'fields', 'expand', 'avg', 'sum', 'q', 'like'];
	var validOperators = ['lt', 'lte', 'gt', 'gte', 'in'];

	/**
	 * Save associated resources of instance
	 *
	 * @param  {[type]} 	instance  saved instance
	 * @param  {[type]} 	modelData POST data
	 * @return {Promise}
	 */
	var saveAssociations = function(instance, modelData) {
		var assocs = instance.getAssociations();
		var assocNames = Object.keys(assocs);

		return new sequelize.Promise(function(resolve, reject) {
			var saveAssoc = function(assoc, done) {
				if(modelData[assoc] && Array.isArray(modelData[assoc])) {

					// get Sequelize Model for associated resource to build instance with POST data
					var AssocModel = assocs[assoc].target;
					var data = modelData[assoc].map(function(item) {
						return AssocModel.build(item);
					});

					// build method to set associated resources on instance which is "set[association name plural]" e.g. "setJobapplications"
					// this will also persist associated resources to database
					var method = 'set' + assoc.substr(0, 1).toUpperCase() + assoc.substr(1);
					instance[method](data)
					.then(function() {
						done();
					})
					.catch(function(err) {
						done(err);
					});
				}
				else done();
			};

			async.each(assocNames, saveAssoc, function(err) {
				if(err) reject(err);
				else resolve();
			});
		});
	};

	var checkModel = function(incResult, targ, result) {
		if(targ.model === result.model) {
			if(targ.where) {
				for(var prop in result.where) {
					targ.where[prop] = result.where[prop];
				}
			}
			else if(targ.attributes) targ.attributes = targ.attributes.concat(result.attributes);
			else if(targ.include && result.include) checkModel(incResult, targ.include, result.include);
		}
		else if(targ.include && result.include) checkModel(incResult, targ.include, result.include);
		else incResult.push(result);
	};

	return {
		/**
		 * Get number of resources, optionally filtered by criteria
		 *
		 * @param  {Object} criteria
		 * @param  {Object} defaults 	default options to pass to WHERE
		 * @return {Promise}
		 */
		count: function(criteria, defaults) {
			var options = {};
			var result;

			if(criteria) {

				// filtering by resource properties (WHERE)
				if(Object.keys(criteria).length) {

					var fields = Object.keys(criteria).filter(function(field) {
						return field.indexOf('.') !== -1;
					}).join(',');

					// build filtering object for associated resources when any of the filtering fields contains a dot
					// in which case the filtering indicates a associated resource that will be automatically expanded
					if(fields.length) {
						result = this.checkAssociations(fields, criteria);

						if('error' in result) return result.error;
						else {
							// if there is already a key "include" in options it means that the associated resource to filter by
							// might also listed in the "expand" query parameter
							// this "include" key can be overwritten but in case the expand parameter indicated a field of an
							// associated resource (expand=resource.field) then a key "attributes" is present which must be included
							if('include' in options) {

								// make a copy of option.include and filter any associations which are also automatically expanded by filtering any of their properties
								// the copy is needed to determine later if the original options.include containes any "attributes" keys that specify which fields of
								// the expanded resources to return.
								// If these are present they need to be copied, otherwise filtering on properties of associated resources will cause all fields of these
								// resources to be returned, even when is specified that only certain fields need to be returned
								var org = options.include;
								options.include = options.include.filter(function(assoc) {
									return _.findWhere(result.associations, {as: assoc.as}) === undefined;
								});

								options.include = options.include.concat(result.associations.map(function(assoc) {

									var inc = _.findWhere(org, {as: assoc.as});
									if(inc !== undefined) {

										if(inc.attributes) assoc.attributes = inc.attributes;

										// if includes are found traverse down the tree to determine if any more attributes need to be added
										if('include' in inc) {
											var src = inc;
											var targ = assoc;

											while('include' in src && 'include' in targ) {
												if(src.include.attributes) assoc.include.attributes = src.include.attributes;
												src = src.include;
												targ = targ.include;
											}

										}
									}
									return assoc;
								}));
							}
							else {
								options.include = result.associations;
							}
						}
					}

					result = this.buildQuery(criteria);

					if('error' in result) return result.error;
					else options.where = result.query;
				}

				if(defaults) {
					if(options.where === undefined) options.where = {};
					for(var prop in defaults) {
						if(this.model.hasField(prop)) options.where[prop] = defaults[prop];
						else return this.fieldError('[resource property]', prop);
					}
				}
			}

			return this.model.count(options);
		},

		/**
		 * Search resource by search term in parameter "q"
		 * By default the search will be performed on all properties of the resource, parameter "fields" may
		 * specify a comma separated list of fields to be searched.
		 * The search is based on OR and "=" comparison, if parameter "like=true" or "like=1" is present, the search will be based in LIKE '%[value]%' comparison
		 *
		 * @param  {Object} criteria
		 * @param  {Object} defaults default options to pass to WHERE
		 * @return {Promise}
		 */
		search: function(criteria, defaults) {
			var fields;
			var res;
			var $or;
			var query;
			var like;
			var options = {
				where: {}
			};

			// search parameter "q" is required
			if(!('q' in criteria) || criteria.q === '')	return this.error("search parameter 'q' cannot be empty", 'Parsing error', 'q', '[empty]');

			// if "like=true" or "like=1" is in query perform a LIKE comparison
			like = 'like' in criteria && (criteria.like === '1' || criteria.like === 'true');

			// search only specified fields in parameter "fields"
			if('fields' in criteria && criteria.fields !== '') {
				res = this.checkFilterFields(criteria.fields);

				if('error' in res) return res.error;

				fields = criteria.fields.split(',');
			}
			// search all fields
			else fields = this.model.getFields();

			query = criteria.q;

			// build WHERE clause
			$or = fields.map(function(field) {
				var or = {};

				// LIKE comparison
				if(like) {
					or[field] = {
						$like: '%' + query + '%'
					};
				}
				// "=" comparison
				else or[field] = query;

				return or;
			});

			options.where.$or = $or;

			// subresources to return in response
			if('expand' in criteria) {
				var result = this.checkAssociations(criteria.expand);

				if('error' in result) return result.error;

				options.include = result.associations;
			}

			// filtering by resource properties (WHERE)
			if(Object.keys(criteria).length) {

				fields = Object.keys(criteria).filter(function(field) {
					return field.indexOf('.') !== -1;
				}).join(',');

				// build filtering object for associated resources when any of the filtering fields contains a dot
				// in which case the filtering indicates a associated resource that will be automatically expanded
				if(fields.length) {
						result = this.checkAssociations(fields, criteria);

						if('error' in result) return result.error;
						else {
							// if there is already a key "include" in options it means that the associated resource to filter by
							// might also listed in the "expand" query parameter
							// this "include" key can be overwritten but in case the expand parameter indicated a field of an
							// associated resource (expand=resource.field) then a key "attributes" is present which must be included
							if('include' in options) {
								var org = options.include;
								options.include = options.include.filter(function(assoc) {
									return _.findWhere(result.associations, {as: assoc.as}) === undefined;
								});

								options.include = options.include.concat(result.associations.map(function(assoc) {

									var inc = _.findWhere(org, {as: assoc.as});
									if(inc !== undefined) {

										if(inc.attributes) assoc.attributes = inc.attributes;

										// if includes are found traverse down the tree to determine if any more attributes need to be added
										if('include' in inc) {
											var src = inc;
											var targ = assoc;

											while('include' in src && 'include' in targ) {
												if(src.include.attributes) assoc.include.attributes = src.include.attributes;
												src = src.include;
												targ = targ.include;
											}
										}
									}
									return assoc;
								}));
							}
							else {
								options.include = result.associations;
							}
						}
					}

				res = this.buildQuery(criteria);

				if('error' in res) return res.error;
				else {
					for(var prop in res.query) {
						options.where[prop] = res.query[prop];
					}
				}
			}

			// parse offset and limit if present in request parameters
			if('offset' in criteria) {
				res = this.checkOffset(criteria);

				if('error' in res) return res.error;

				options.offset = res.offset;
			}
			if('limit' in criteria) {
				res = this.checkLimit(criteria);

				if('error' in res) return res.error;

				options.limit = res.limit;
			}
			else options.limit = this.getLimit();


			if(defaults) {
				for(var prop in defaults) {
					if(this.model.hasField(prop)) options.where[prop] = defaults[prop];
					else return this.fieldError('[resource property]', prop);
				}
			}

			return this.model.findAndCountAll(options);
		},

		/**
		 * Get collection of resources including count, optionally filtered by criteria
		 *
		 * @param  {Object} criteria
		 * @param  {Object} defaults 	default options to pass to WHERE
		 * @return {Promise}
		 */
		index: function(criteria, defaults) {
			var options = {};
			var res;

			if(criteria) {
				// parse offset and limit if present in request parameters
				if('offset' in criteria) {
					res = this.checkOffset(criteria);

					if('error' in res) return res.error;

					options.offset = res.offset;
				}
				if('limit' in criteria) {
					res = this.checkLimit(criteria);

					if('error' in res) return res.error;

					options.limit = res.limit;
				}
				else options.limit = this.getLimit();

				// subresources to return in response
				if('expand' in criteria) {
					var result = this.checkAssociations(criteria.expand);

					if('error' in result) return result.error;

					options.include = result.associations;
				}

				// filtering by resource properties (WHERE)
				if(Object.keys(criteria).length) {

					var fields = Object.keys(criteria).filter(function(field) {
						return field.indexOf('.') !== -1;
					}).join(',');

					// build filtering object for associated resources when any of the filtering fields contains a dot
					// in which case the filtering indicates a associated resource that will be automatically expanded
					if(fields.length) {
						result = this.checkAssociations(fields, criteria);

						if('error' in result) return result.error;
						else {
							// if there is already a key "include" in options it means that the associated resource to filter by
							// might also listed in the "expand" query parameter
							// this "include" key can be overwritten but in case the expand parameter indicated a field of an
							// associated resource (expand=resource.field) then a key "attributes" is present which must be included
							if('include' in options) {

								// make a copy of option.include and filter any associations which are also automatically expanded by filtering any of their properties
								// the copy is needed to determine later if the original options.include containes any "attributes" keys that specify which fields of
								// the expanded resources to return.
								// If these are present they need to be copied, otherwise filtering on properties of associated resources will cause all fields of these
								// resources to be returned, even when is specified that only certain fields need to be returned
								var org = options.include;
								options.include = options.include.filter(function(assoc) {
									return _.findWhere(result.associations, {as: assoc.as}) === undefined;
								});

								options.include = options.include.concat(result.associations.map(function(assoc) {

									var inc = _.findWhere(org, {as: assoc.as});
									if(inc !== undefined) {

										if(inc.attributes) assoc.attributes = inc.attributes;

										// if includes are found traverse down the tree to determine if any more attributes need to be added
										if('include' in inc) {
											var src = inc;
											var targ = assoc;

											while('include' in src && 'include' in targ) {
												if(src.include.attributes) assoc.include.attributes = src.include.attributes;
												src = src.include;
												targ = targ.include;
											}

										}
									}
									return assoc;
								}));
							}
							else {
								options.include = result.associations;
							}
						}
					}

					result = this.buildQuery(criteria);

					if('error' in result) return result.error;
					else options.where = result.query;
				}

				if(defaults) {
					if(options.where === undefined) options.where = {};
					for(var prop in defaults) {
						if(this.model.hasField(prop)) options.where[prop] = defaults[prop];
						else return this.fieldError('[resource property]', prop);
					}
				}


				// order
				if('order' in criteria) {
					var res = this.checkOrderFields(criteria.order);

					if('error' in res) return res.error;

					options.order = res.order;
				}

				// group
				if('group' in criteria) {
					if(!this.model.hasFieldOrAssociation(criteria.group)) return this.fieldError('group', criteria.group);
					options.group = criteria.group;
				}

				// fields to return in response
				if('fields' in criteria) {
					res = this.checkFilterFields(criteria.fields);

					if('error' in res) return res.error;

					options.attributes = res.fields;
				}

				// aggregate functions (sum, avg etc.)
				if(this.hasAggregateFunctions(criteria)) {
					if(options.attributes === undefined) options.attributes = [];

					var err;
					aggFuncs.forEach(function(func) {
						if(func in criteria) {
							criteria[func].split(',').forEach(function(field) {
								if(!this.model.hasFieldOrAssociation(field)) err = this.fieldError(func, field);
								else options.attributes.push([sequelize.fn(func, sequelize.col(field)), field]);
							}, this);
						}
					}, this);

					// unknown field(s) specified in aggregate function
					if(err) return err;
				}
			}
			return this.model.findAndCountAll(options);
		},

		/**
		 * Get single resource
		 *
		 * @param  {String} id
		 * @param  {Object} criteria object holding query parameters
		 * @return {Promise}
		 */
		show: function(id, criteria) {
			var options = {};
			var result;
			if(criteria) {
				options.where = {
					id: id
				};

				// filtering by resource properties (WHERE)
				if(Object.keys(criteria).length) {
					result = this.checkAssociations(criteria);

					if('error' in result) return result.error;
					else {
						// if there is already a key "include" in options it means that the associated resource to filter by
						// might also listed in the "expand" query parameter
						// this "include" key can be overwritten but in case the expand parameter indicated a field of an
						// associated resource (expand=resource.field) then a key "attributes" is present which must be included
						if('include' in options) {
							var org = options.include;
							options.include = options.include.filter(function(assoc) {
								return _.findWhere(result.associations, {as: assoc.as}) === undefined;
							});

							options.include = options.include.concat(result.associations.map(function(assoc) {

								var inc = _.findWhere(org, {as: assoc.as});
								if(inc !== undefined) {

									if(inc.attributes) assoc.attributes = inc.attributes;

									// if includes are found traverse down the tree to determine if any more attributes need to be added
									if('include' in inc) {
										var src = inc;
										var targ = assoc;

										while('include' in src && 'include' in targ) {
											if(src.include.attributes) assoc.include.attributes = src.include.attributes;
											src = src.include;
											targ = targ.include;
										}

									}
								}
								return assoc;
							}));
						}
						else {
							options.include = result.associations;
						}
					}
					// }
console.log(options.include);
					result = this.buildQuery(criteria);
					if('error' in result) return result.error;
					else {
						for(var prop in result.query) {
							options.where[prop] = result.query[prop];
						}
					}
				}

				// fields to return in response
				if('fields' in criteria) {
					if(criteria.fields === null || criteria.fields === '') {
						return this.error('fields cannot be empty', 'Parsing error', 'fields', '[empty]');
					}

					var res = this.checkFilterFields(criteria.fields);

					if('error' in res) return res.error;

					options.attributes = res.fields;
				}
				return this.model.find(options);
			}
			return this.model.find(id);
		},

		/**
		 * Create resource (INSERT) and any associated resources
		 *
		 * @param  {Object} modelData
		 * @return {Promise}
		 */
		create: function(modelData) {
			var instance = this.model.build(modelData);

			return new sequelize.Promise(function(resolve, reject) {
				this.model.create(modelData)
				.then(function() {
					if(instance.hasAssociations()) return saveAssociations(instance, modelData);
					else resolve(instance);
				})
				.then(function() {
					resolve(instance);
				})
				.catch(function(err) {
					reject(err);
				});
			}.bind(this));
		},

		/**
		 * Save resource (UPDATE) and any associated resources
		 *
		 * @param  {Object} 	params
		 * @param  {Object} 	modelData
		 * @param  {Boolean} 	noReturn	if true, do not return the saved resource
		 * @return {Promise}
		 */
		update: function(params, modelData, noReturn) {
			var instance = this.model.build(modelData);

			return new sequelize.Promise(function(resolve, reject) {
				this.model.update(modelData, {where: params})
				.then(function() {
					if(instance.hasAssociations()) return saveAssociations(instance, modelData);
					else if(noReturn) resolve();
					else resolve(instance);
				})
				.then(function() {
					if(noReturn) resolve();
					else resolve(instance);
				})
				.catch(function(err) {
					reject(err);
				});
			}.bind(this));
		},

		/**
		 * Delete resource
		 *
		 * @param  {Object} params
		 * @return {Promise}
		 */
		delete: function(params) {
			return this.model.destroy({where: params});
		},

		/**
		 * Set model for communication with Sequelize
		 *
		 * @param {SequelizeModel} model
		 */
		setModel: function(model) {
			this.model = model;
		},

		/**
		 * Return default query LIMIT
		 *
		 * @return {Number}
		 */
		getLimit: function() {
			return app.get('queryLimit');
		},

		/**
		 * Builds query object based on URL parameters
		 *
		 * @param  {Object} 	criteria
		 * @return {Object}     object with property "query" holding the query object, or "error" in case of error
		 */
		buildQuery: function(criteria) {
			var query = {};

			for(var attr in criteria) {

				// ignore reserved query parameters
				if(reservedParameters.indexOf(attr) === -1) {
					var fullAttr;
					var op = null;

					// query parameter is prefixed by a range parameter (lt, lte, gt or gte)
					if(attr.indexOf('-') !== -1) {
						// save original parameter to get the value of it later
						fullAttr = attr;

						// get range parameter and check if it is valid
						var parts = attr.split('-');
						op = parts[0].toLowerCase();
						if(validOperators.indexOf(op) === -1) {
							return {
								error: this.fieldError('[resource property]', attr)
							};
						}

						attr = parts[1];
					}

					if(!this.model.hasFieldOrAssociation(attr)) {
						if(validOperators.indexOf(op) === -1) {
							return {
								error: this.fieldError('[resource property]', attr)
							};
						}
					}

					// only add the property to filter by to the query if it does not contain a dot
					// if it does contain a dot it specifies the field of an associated resource
					if(attr.indexOf('.') === -1) {

						// a range parameter has been specified
						if(op !== null) {
							if(!query[attr]) query[attr] = {};

							// if operator is 'in', the parameter is a comma-delimited list and should be converted to an array
							if(op === 'in') query[attr][op] = criteria[fullAttr].split(',');
							else query[attr][op] = criteria[fullAttr];
						}
						else query[attr] = criteria[attr];
					}
				}
			}

			return {
				query: query
			};
		},

		/**
		 * Check if any aggregate functions have been specified in query (sum, avg etc.)
		 *
		 * @param  {Object}  criteria
		 * @return {Boolean}
		 */
		hasAggregateFunctions: function(criteria) {
			return aggFuncs.some(function(func) {
				return func in criteria;
			});
		},

		/**
		 * Check if "offset" parameter is a valid value and return it in key "offset", otherwise return error
		 *
		 * @param  {Object} 	criteria
		 * @return {Object}     object with property "offset" or "error" in case of error
		 */
		checkOffset: function(criteria) {
			var offset = parseInt(criteria.offset, 10);

			// offset must be a valid number
			if(isNaN(offset)) {
				return {
					error: this.error('offset must be a valid number, greater than or equal to 0', 'Parsing error', 'offset', criteria.offset)
				};
			}

			// offset must be 0 or greater
			if(offset < 0) {
				return {
					error: this.error('offset must be greater than or equal to 0', 'Parsing error', 'offset', criteria.offset)
				};
			}

			return {
				offset: offset
			};
		},

		/**
		 * Check if "limit" parameter is a valid value and return it in key "limit", otherwise return error
		 *
		 * @param  {Object} 	criteria
		 * @return {Object}     object with property "limit" or "error" in case of error
		 */
		checkLimit: function(criteria) {
			var limit = parseInt(criteria.limit, 10);

			// limit must be a valid number
			if(isNaN(limit)) {
				return {
					error: this.error('limit must be a valid number, greater than 0', 'Parsing error', 'limit', criteria.limit)
				};
			}

			// limit must be 1 or greater
			if(limit < 1) {
				return {
					error: this.error('limit must be greater than 0', 'Parsing error', 'limit', criteria.limit)
				};
			}

			return {
				limit: limit
			};
		},

		/**
		 * Check if subresources to display are associated with the resource, otherwise return an error .
		 * If the associated resources are found, an object with property "associations" holding the associations is returned.
		 * This returned object has the following properties:
		 *
		 * - model: the model representing this associated resource
		 * - as: the alias of the associated resource
		 * - attributes: optional, the fields to return of the associated resource
		 * - include: optional, any other associated resource of the current associated resource, this recurses down for all associated resources
		 *
		 * For example:
		 *
		 * {
		 *     model: JobPosition
		 *     as: 'jobpositions'
		 *     include: {
		 *     	   model: JobApplication
		 *     	   as: 'jobapplications'
		 *     	   attributes: ['id', 'name']
		 *     	   include: {
		 *     	       ...
		 *     	   }
		 *     }
		 * }
		 *
		 * This resulting object holding all nested resources is placed in the "include" property of the options object for finder methods
		 * (Customer.findAll({include: [nested resources]}))
		 *
		 * @param  {String} assocs 	comma separated list of subresources
		 * @return {Object}       	object with property "associations" holding the associations, or "error" in case of error
		 */
		checkAssociations: function(criteria) {

			var fields = Object.keys(criteria).filter(function(field) {
				return field.indexOf('.') !== -1;
			});

			if(criteria.expand) fields = fields.concat(criteria.expand.split(','));

			var associations = [];

			fields.forEach(function(field) {
				if(associations.indexOf(field) === -1) associations.push(field);
			});

			var unknownAssociations = fields.filter(function(model) {
				return reservedParameters.indexOf(model) === -1 && !this.model.hasAssociation(model);
			}, this);

			if(unknownAssociations.length) {
				var value = unknownAssociations.length > 1 ? unknownAssociations.join(', ') : unknownAssociations[0];
				return {
					error: this.error('Resource has no association(s): ' + value, 'Field error', 'expand', value)
				};
			}

			// return object with key "associations" holding the associated resources
			return {
				associations: associations.reduce(function(incResult, association) {
					var target = this.model;
					var result = {};

					// if there is a dot in the association name it means that a nested association is specified
					// in this case we have to traverse the tree of associations and get the correct models
					if(association.indexOf('.') !== -1) {

						result = association.split('.').reduce(function(res, cur) {
							if(target.associations[cur] !== undefined) {

								var definition = {
									model: target.associations[cur].target,
									as: cur
								};
								// traverse down to get the underlying association
								target = target.associations[cur].target;

								// if key "model" is present it means we have a nested association, so the definition is
								// placed in the key "include"
								if(res.model !== undefined) {
									if(!('include' in res)) {
										res.include = definition;
									}
									else {
										var targ = res.include;

										// the definition must be placed in the most inner "include" key so traverse down
										while('include' in targ) {
											targ = targ.include;
										}
										targ.include = definition;
									}
									return res;
								}
								res = definition;
								return res;
							}
							// no nested association present, the part after the dot indicates a field of the higher level resource
							else if(target.attributes[cur] !== undefined) {
								// if the field [association] is present as a URL parameter it is placed in the "where" key so
								// associated resources are filtered by this field
								// if not, the field is placed in the "attributes" key so only the specified field of the associated resource
								// is returned
								if(criteria[association]) {
									if(!('include' in res)) {
										res.where = {};
										res.where[cur] = criteria[association];
									}
									else {
										targ = res.include;

										// the WHERE must be placed in the most inner "include" key so traverse down
										while('include' in targ) {
											targ = targ.include;
										}
										targ.where = {};
										targ.where[cur] = criteria[association];
										targ.required = false;
									}
								}
								else {
									if('include' in res) {
										targ = res.include;

										/// the "attributes" key must be placed in the most inner "include" key so traverse down
										while('include' in targ) {
											targ = targ.include;
										}
										targ.attributes = [cur];
									}
									else res.attributes = [cur];
								}

								return res;
							}
							return res;

						}, {});

						if(incResult.length) checkModel(incResult, incResult[incResult.length - 1], result);
						else incResult.push(result);

						return incResult;
					}

					// return associated resource in key "model" and alias in key "as"
					incResult.push({
						model: target.associations[association].target,
						as: association
					});

					return incResult;
				}.bind(this), [])
			};
		},

		/**
		 * Check if fields to filter by are present on resource, return error if not
		 *
		 * IMPORTANT: to be able to generate the correct resource links the 'id' field is ALWAYS added to the fields
		 *
		 * @param  {String} filterFields comma separated list of filter fields
		 * @return {Object}              object with property "fields" or "error" in case of error
		 */
		checkFilterFields: function(filterFields) {
			if(filterFields === null || filterFields === '') {
				return {
					error: this.error('fields cannot be empty', 'Parsing error', 'fields', '[empty]')
				};
			}

			var fields = filterFields.split(',');

			// add 'id' field (if not present) for resource links
			// if(fields.indexOf('id') === -1) fields.unshift('id');

			// check for unknown fields
			var unknownFields = fields.filter(function(field) {
				return !this.model.hasFieldOrAssociation(field);
			}, this);

			// unknown fields found, return error
			if(unknownFields.length) {
				var value = unknownFields.length > 1 ? unknownFields.join(', ') : unknownFields[0];

				return {
					error: this.fieldError('fields', value)
				};
			}

			return {
				fields: fields
			};
		},

		/**
		 * Check if fields to order by are present on resource, return error if not
		 *
		 * @param  {String} orderFields comma separated list of order fields
		 * @return {Object}              object with property "order" or "error" in case of error
		 */
		checkOrderFields: function(orderFields) {
			if(orderFields === null || orderFields === '') {
				return {
					error: this.error('order cannot be empty', 'Parsing error', 'order', '[empty]')
				};
			}

			var fields = orderFields.split(',');

			// strip any '-' signs at first position of field (used to indicate DESC)
			var sanitized = fields.map(function(field) {
				return field.substr(0, 1) === '-' ? field.substr(1) : field;
			});

			// check for unknown fields
			var unknownFields = sanitized.filter(function(field) {
				return !this.model.hasFieldOrAssociation(field);
			}, this);

			// unknown fields found, return error
			if(unknownFields.length) {
				var value = unknownFields.length > 1 ? unknownFields.join(', ') : unknownFields[0];

				return {
					error: this.fieldError('order', value)
				};
			}

			var ret = {
				order: fields.map(function(field) {
					return field.substr(0, 1) === '-' ? [field.substr(1), 'DESC'] : field;
				})
			};

			return ret;
		},

		/**
		 * Return a promise which is rejected with a sequelize.ValidationErrorItem
		 *
		 * @param  {String} message		the error message
		 * @param  {String} type		the error type
		 * @param  {String} field 		the field which holds an illegal value
		 * @param  {String} value 		the illegal value, must be cast to string, otherwise 0 will result in "null"
		 * @return {Promise}
		 */
		error: function(message, type, field, value) {
			return new sequelize.Promise.reject(new sequelize.ValidationErrorItem(message, type, field, value.toString()));
		},

		/**
		 * Return an error when an unknown resource field is specified
		 *
		 * @param  {String} field the field which holds an illegal value
		 * @param  {String} value the illegal value
		 * @return {Promise}
		 */
		fieldError: function(field, value) {
			return this.error('Resource has no field(s): ' + value, 'Field error', field, value);
		}
	};
};
