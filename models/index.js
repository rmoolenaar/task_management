var fs        = require('fs')
  , path      = require('path')
  , Sequelize = require('sequelize')
  , lodash    = require('lodash')
  , pg        = require('pg')
  , sequelize = {}
  , db        = {};

console.log('Opening database');


var classMethods = {
    /**
     * Get plural name of model as string
     *
     * @return {String}
     */
    getPluralName: function() {
        return this.options.name.plural.toLowerCase();
    },

    /**
     * Get fields of the model
     *
     * @return {Array}
     */
    getFields: function() {
        return Object.keys(this.attributes);
    },

    /**
     * Return any associated resources
     *
     * @return {Object}
     */
    getAssociations: function() {
        return this.associations;
    },

    /**
     * Check if model has the field specified by the "field" parameter
     *
     * @param  {String}  field
     * @return {Boolean}
     */
    hasField: function(field) {
        return field in this.attributes;
    },

    /**
     * Check if model has the associated resource specified by the "association" parameter
     *
     *
     * @param  {String}  association
     * @return {Boolean}
     */
    hasAssociation: function(association) {
        if(association.indexOf('.') !== -1) {

            var target = this;

            // traverse associations
            return association.split('.').every(function(assoc) {
                var result = target.associations !== undefined ? Object.keys(target.associations).indexOf(assoc) !== -1 : false;

                if(result) target = target.associations[assoc].target;
                else result = Object.keys(target.attributes).indexOf(assoc) !== -1;
                return result;
            });
        }

        return Object.keys(this.associations).indexOf(association) !== -1;
    },

    /**
     * Check if model has the field or associated resource specified by the "field" parameter
     *
     * @param  {String}  field
     * @return {Boolean}
     */
    hasFieldOrAssociation: function(field) {
        return this.hasField(field) || this.hasAssociation(field);
    },

    /**
     * Check if the model has any associated resources
     *
     * @return {Boolean}
     */
    hasAssociations: function() {
        return Object.keys(this.associations).length > 0;
    }
};

var instanceMethods = {
    /**
     * Check if resource has associated resources
     *
     * @return {Boolean}
     */
    hasAssociations: function() {
        return Object.keys(this.Model.associations).length > 0;
    },

    /**
     * Return any associated resources
     *
     * @return {Object}
     */
    getAssociations: function() {
        return this.Model.associations;
    },

    /**
     * Get plural name of resource as string
     *
     * @return {String}
     */
    getPluralName: function() {
        return this['$modelOptions'].name.plural.toLowerCase();
    },

    /**
     * Set link on resource pointing to itself.
     * Link is an object with property "rel" with value "self" and "href" with value consisting of plural name of resource
     * plus id of resource, optionally prefixed with base url.
     * Example with base url: 		http://app.whires.local/v1/customers/3401
     * Example without base url: 	/v1/customers/3401
     *
     * @param {String} base optional base url
     */
    setSelfLink: function(base) {
        var baseUrl = base || '';
        this.setDataValue('link', {
            rel: 'self',
            href: baseUrl + '/' + this.getPluralName() + '/' + this.id
        });
    }
};

if (process.env.DATABASE_URL) {
    pg.defaults.ssl = true;
    // On Heroku use local Postgres database instead of MySQL
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        omitNull: false,
        dialect: 'postgres',
        define: {
            timestamps: true,
            classMethods: classMethods,
            instanceMethods: instanceMethods
        }
    });
} else {
    sequelize = new Sequelize('taskmanagement', 'taskmanagement', 'h5F22fgtrrPolkky', {
        omitNull: false,
        define: {
            timestamps: true,
            classMethods: classMethods,
            instanceMethods: instanceMethods
        }
    });
}

sequelize.custom = {
    /**
     * Return standardized error messages
     *
     * @param  {String}  type       Type of error (REQUIRED, EMAIL, ...)
     * @param  {String}  param1     Extra parameter: will hold maximum allowed size for MAXSIZE error
     * @param  {String}  param2     Extra parameter: will hold maximum allowed size for RANGE error
     * @return {String}
     */
    validationError: function(type, param1, param2) {
        if (type === 'MAXSIZE') {
            return 'Maximum length is ' + param1 + ' characters';
        }
        if (type === 'RANGE') {
            return 'Field must be between ' + param1 + ' and ' + param2;
        }
        if (type === 'EMAIL') {
            return 'Field does not contain a valid e-mail address';
        }
        return '';
    }
};


// models
var User = sequelize.import(path.join(__dirname, 'user.js'));
db[User.name] = User;
var Task = sequelize.import(path.join(__dirname, '../routes/api/task/task.model.js'));
db[Task.name] = Task;


User.hasMany(Task, {as: 'tasks', foreignKey: 'user_id'});


module.exports = lodash.extend({
    sequelize: sequelize,
    Sequelize: Sequelize
}, db);
