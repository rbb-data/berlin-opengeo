/* eslint-env mocha */
process.env.DB_URL = 'mongodb://localhost:21080/geocoder'

const {expect} = require('chai')

const request = require('supertest')
const app = require('../index')

const fixture = require('./fixtures/leerstand.json')

describe('api', function () {
  describe('/bulk', function () {
    it('should respond with a code of 400 when not providing any post data', function (done) {
      request(app).post('/bulk').expect(400, done)
    })

    it('should respond with a status of 400 when not providing a representational mapping', function (done) {
      request(app)
        .post('/bulk')
        .type('json')
        .send(fixture)
        .expect(400, done)
    })

    it('should accept json', function (done) {
      request(app)
        .post('/bulk/str_hnr,strasse,plz')
        .query({ 'str_hnr': 'Strasse', 'plz': 'Plz' })
        .type('json')
        .send(fixture)
        .expect(200, done)
    })

    it('should be able to respond with json')
    it('should be able to respond with csv')

    it('should merge the additional information with our post body in the response', function (done) {
      request(app)
        .post('/bulk/str_hnr,strasse,plz')
        .query({ 'str_hnr': 'Strasse', 'plz': 'Plz' })
        .type('json')
        .send(fixture)
        .expect(200)
        .end((err, res) => {
          expect(err).to.not.exist // eslint-disable-line
          done()
        })
    })

    it('should produce the exact same response when the result is sent to the server again')
  })
})
