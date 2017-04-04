/* eslint-env mocha */
process.env.DB_URL = 'mongodb://localhost:21080/geocoder'

const {expect} = require('chai')

const request = require('supertest')
const app = require('../index')

const fixtures = {
  emptyHouses: require('./fixtures/leerstand.json'),
  regulatoryAgency: require('./fixtures/ordnungsamt.json')
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

    it('should return the properties that we asked for in the url', function (done) {
      const props = Object.keys(fixtures.regulatoryAgency[0]).concat(['plz', 'ortsteil'])

      request(app)
        .post('/bulk/plz,ortsteil')
        .query({ 'str_hnr': 'street', 'ortsteil': 'area' })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(fixtures.regulatoryAgency.slice(0, 20))
        .expect(200)
        .then(res => {
          res.body.forEach(result => {
            Object.keys(result)
              .filter(k => k !== '_id')
              .forEach(k => {
                expect(props).to.include(k)
              })
          })
          done()
        })
    })

    it('should produce the exact same response when a result is sent again', function (done) {
      let testCase = request(app)
        .post('/bulk/lor_plr,lor_plr_nr')
        .query({ 'str_hnr': 'str_hnr' })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')

      testCase
        .send(fixtures.regulatoryAgency.slice(0, 10))
        .expect(200)
        .then(res1 => {
          testCase
            .send(res1)
            .expect(200)
            .then(res2 => {
              expect(res1).to.deep.equal(res2)
              done()
            })
        })
    })

    it('should not care about input types and convert them automatically', function (done) {
      let testCase = request(app)
        .post('/bulk/str_hnr,plz')
        .query({ 'str_hnr': 'str_hnr', 'plz': 'plz' })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')

      testCase
        .send([{ str_hnr: 'Elsenstraße 110', plz: '12435' }])
        .expect(200)
        .then(res1 => {
          testCase
            .send([{ str_hnr: 'Elsenstraße 110', plz: 12435 }])
            .expect(200)
            .then(res2 => {
              expect(res1.body).to.deep.equal(res2.body)
              done()
            })
        })
    })

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
