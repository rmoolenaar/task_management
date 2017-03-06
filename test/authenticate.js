var assert = require('assert');
var request = require('supertest');
var app = require('../app.js');

describe('Authentication', function() {

    it('should not be able to login without user', function(done) {
        request(app)
            .post('/apipublic/v1/login')
            .expect(401, done);
    });

    it('should be able to login with valid user', function(done) {
        request(app)
            .post('/apipublic/v1/login')
            .send('username=remco@javadb.nl&password=testpwd\\!')
            .expect(200)
            .end(function(err, res) {
                if (err) {
                    return done(err);
                }
                var result = JSON.parse(res.text);
                //console.log(result.token);
                done();
            })
    });
});
