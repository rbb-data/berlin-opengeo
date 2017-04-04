/* eslint-env mocha */
process.env.DB_URL = 'mongodb://localhost:21080/geocoder'

const {expect} = require('chai')

const request = require('supertest')
const app = require('../index')

const fixtures = {
  emptyHouses: require('./fixtures/leerstand.json')
}

describe('api', function () {
  describe('/bulk', function () {
    it('should respond with a code of 400 when not providing any post data', function (done) {
      request(app).post('/bulk').expect(400, done)
    })

    it('should respond with a status of 400 when not providing a representational mapping', function (done) {
      request(app)
        .post('/bulk')
        .type('json')
        .send(fixtures.emptyHouses)
        .expect(400, done)
    })

    it('should accept json', function (done) {
      request(app)
        .post('/bulk/str_hnr,strasse,plz')
        .query({ 'str_hnr': 'Strasse', 'plz': 'Plz' })
        .set('Content-Type', 'application/json')
        .send(fixtures.emptyHouses)
        .expect(200, done)
    })

    it('should accept csv')

    it('should be able to respond with json', function (done) {
      request(app)
        .post('/bulk/str_hnr')
        .query({ 'str_hnr': 'Strasse' })
        .set('Accept', 'application/json')
        .send(fixtures.emptyHouses.slice(0, 1))
        .expect('Content-Type', /^application\/json/)
        .expect(200, done)
    })

    it('should be able to respond with csv')

    it('should merge the additional information with our post body in the response', function (done) {
      request(app)
        .post('/bulk/str_hnr,strasse,plz')
        .query({ 'str_hnr': 'Strasse', 'plz': 'Plz' })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(fixtures.emptyHouses)
        .expect(res => {
          res.body.forEach(result => {
            expect(result).to.have.property('str_hnr')
            expect(result).to.have.property('strasse')
            expect(result).to.have.property('plz')
          })
        })
        .expect(200, done)
    })

    it('should produce the exact same response when a result is sent again')
    it('should not care about input types and convert them automatically')

    it('should only return results that are unambiguous', function (done) {
      request(app)
        .post('/bulk/str_hnr')
        .query({ 'plz': 'plz' })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send([{ plz: 12435 }])
        .expect(res => {
          expect(res.body).to.have.lengthOf(1)
          expect(res.body[0]).to.have.property('str_hnr', '')
        })
        .expect(200, done)
    })
  })
})
