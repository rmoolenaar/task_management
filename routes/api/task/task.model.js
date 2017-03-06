'use strict';

module.exports = function(sequelize, DataTypes) {
	return sequelize.define('Task', {
		name: {
            type: DataTypes.STRING,
            allowNull: false,
			validate: {
				len: {
					args: [1,200],
					msg: sequelize.custom.validationError('MAXSIZE', 200)
				}
			}
        },
        endDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false
        },
        user_id: {
            type: DataTypes.BIGINT,
            allowNull: false
        }
	},

	{
		freezeTableName: true,
		tableName: 'task'
	});
};
