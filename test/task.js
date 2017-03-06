var assert = require('assert');
var request = require('supertest');
var app = require('../app.js');

describe('Times API calls', function() {

    var token = null;
    // First: authenticate user and save token
    before(function(done) {
        request(app)
            .post('/apipublic/v1/login')
            .send('username=remco@javadb.nl&password=testpwd\\!')
            .expect(200)
            .end(function(err, res) {
                if (err) {
                    return done(err);
                }
                var result = JSON.parse(res.text);
                // Save token
                token = result.token;
                done();
            });
    });

    it('should be not able to load task API when not logged in', function(done) {
        request(app)
            .get('/api/v1/tasks')
            .expect(401)
            .end(function(err, res) {
                if (err) {
                    return done(err);
                }
                done();
            });
    });

    it('should be able to load task API', function(done) {
        request(app)
            .get('/api/v1/tasks')
            .set('Authorization', 'Bearer ' + token)
            .expect(200)
            .end(function(err, res) {
                if (err) {
                    return done(err);
                }
                var result = JSON.parse(res.text);
                assert.equal(true, Array.isArray(result.items));
                done();
            });
    });
});
