
var crypto = require('crypto');

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('User', {
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        password: {
            type: DataTypes.STRING,
            set: function(password) {
                this.setDataValue('password', this.encryptPassword(password));
            },
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        level: { /* 0 = superuser, 50 = manager, 100 = regular user */
            type: DataTypes.INTEGER,
            allowNull: false
        }
    },
    {
        instanceMethods: {
            encryptPassword: function(password) {
                if (!password) {
                    return '';
                }
                return crypto.pbkdf2Sync(password, 'put_your_salt_here', 10000, 32, 'sha256').toString('base64');
            },
            isValidPassword: function(plainText) {
                return this.encryptPassword(plainText) === this.password;
            }
        },
        freezeTableName: true,
        tableName: 'user'
    });
};
