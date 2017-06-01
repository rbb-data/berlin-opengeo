const {
  PORT = 9000,
  DB_URL = 'mongodb://localhost:21017/geocoder',
  DB_COLLECTION = 'data',
  QUERY_LIMIT = 0
} = process.env

const Log = require('log') // eslint-disable-line no-unused-vars
const log = new Log() // eslint-disable-line no-unused-vars

const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const bodyParser = require('body-parser')

const { MongoClient } = require('mongodb')
const csv = require('json2csv')

const app = express()

const buildQuery = require('./utils/build-query')
const smartQuery = require('./utils/smart-query')

// parse query strings
app.set('query parser', 'simple')

MongoClient.connect(DB_URL)
  .then(db => {
    app.db = db.collection(DB_COLLECTION)
    if (!module.parent) console.log(`Connected to database at ${DB_URL}`)
  })
  .catch(err => {
    console.error(err)
    return process.exit(1)
  })

// logging
if (!module.parent) app.use(morgan('short'))

// wildcard CORS header
app.use(cors())

// parse JSON POST bodies
app.use(bodyParser.json({ limit: '5mb' }))

const { exactProps, fuzzyProps } = require('./config')
const metaProps = ['limit', 'format', 'fuzzy']
const allProps = fuzzyProps.concat(exactProps).concat(metaProps).sort()

/**
 * Enable users to filter returned properties by appending them to the URL,
 * separated by comma. No filter means all propertes.
 * Unknown properties are ignored.
 * @param  {Request} req
 * @return {Object}
 */
function getProjection (req) {
  // take the ones given in the request path, or if none are given, all
  const requestedProjection = (req.params.projection ? req.params.projection.split(',') : allProps)
    .filter(prop => allProps.indexOf(prop) !== -1)
  // build the projection object ({ key1: 1, key2: 1})
  let projection = {}
  for (let p of requestedProjection) projection[p] = 1
  return projection
}

/**
 * Route to return all possible matches for a single adress
 */
app.get(['/', '/:projection'], function handleSingleAddress (req, res, next) {
  // build up database query from request's query parameters
  let meta = {
    'limit': QUERY_LIMIT,
    'format': undefined,
    'fuzzy': '0'
  }

  let query = {}
  for (let field of allProps) {
    if (req.query[field]) {
      if (metaProps.indexOf(field) === -1) {
        query[field] = req.query[field]
      } else {
        meta[field] = req.query[field]
      }
    }
  }

  // enable partial matching for string queries
  if (meta.fuzzy !== '0') {
    const regexOperators = /[|\\{}()[\]^$+*?.]/g // taken from https://github.com/sindresorhus/escape-string-regexp/blob/7fe01ba/index.js
    for (let k in query) {
      if (query.hasOwnProperty(k) && fuzzyProps.indexOf(k) !== -1) {
        query[k] = new RegExp(query[k].replace(regexOperators, '\\$&'))
      }
    }
  }

  // filter by at least one criterium
  if (!Object.keys(query).length) {
    const fields = allProps
      .map(prop => `  - ${prop}${fuzzyProps.indexOf(prop) !== -1 ? ' (fuzzy)' : ''}`)
      .join('\n')
    return res
      .status(400)
      .type('text/plain')
      .send(`Please enter at least one of the following filters:\n\n${fields}`)
  }

  // get requested properties from url
  const projection = getProjection(req)

  // simsalabim 🔮
  const cursor = app.db.find(query, projection)
    .limit(parseInt(meta.limit, 10))

  let firstResponse = true

  // use ?format= parameter or "Accepts" header
  switch (meta.format || req.accepts(['csv', 'json'])) {
    case 'csv':
      res.type('csv')
      cursor
        .on('data', doc => {
          res.write(csv({ data: doc, hasCSVColumnTitle: firstResponse }) + '\n')
          firstResponse = false
        })
        .on('end', _ => {
          res.flush()
          res.end()
          next()
        })
      break
    default:
      // even though the docs say 'should respond with 406 "Not Acceptable"'
      res.type('json')
      res.write('[')
      cursor
        .on('data', doc => {
          if (!firstResponse) {
            res.write(',')
          }
          res.write(JSON.stringify(doc))
          firstResponse = false
        })
        .on('end', _ => {
          res.write(']')
          res.flush()
          res.end()
          next()
        })
      break
  }
})

/**
 * Route to do bulk geocoding of multiple adresses; each adress just gets one
 * match
 */
app.post(['/bulk', '/bulk/:projection'], function handleBulkGeocoding (req, res, next) {
  if (!Array.isArray(req.body)) {
    return res.status(400)
      .type('text/plain')
      .send('Please provide an array of elements to be geocoded')
  }

  const format = req.query.format

  // get mapping from the query; it's given as query params, looking like `fieldname_in_db=fieldname_in_csv`
  let representation = {}
  for (let prop in req.query) {
    if (allProps.indexOf(prop) !== -1) representation[prop] = req.query[prop]
  }

  if (!Object.keys(representation).length) {
    return res.status(400)
      .type('text/plain')
      .send(`Please provide the representation as a query string in the following form:)
?field1=name_of_csv_col1&field2=name_of_csv_col2

Available fields that can be queried for are:
${allProps.sort().map(p => ' - ' + p).join('\n')}`)
  }

  // get requested properties (the mongodb projection) from url:
  const projection = getProjection(req)
  const emptyResponse = {}
  for (let k in projection) {
    if (projection.hasOwnProperty(k)) {
      emptyResponse[k] = ''
    }
  }

  // build the query for each adress in the post body and work some magic to
  // improve our results
  const retrievableProps = exactProps.concat(fuzzyProps)
  const queries = req.body
    .map(address => buildQuery(address, representation, retrievableProps))
    .map(query => smartQuery(query))

  // log.debug('body', req.body.slice(0, 5))
  // log.debug('query', queries.slice(0, 5))

  Promise.all(queries.map(query => app.db.find(query, projection).limit(2)))
    // return only those results that are unambiguous
    .then(cursors =>
      Promise.all(cursors.map(c => c.toArray()))
        .then(results => results.map(result => result.length === 1 ? result[0] : {}))
    )
    // merge original field with our results (duplicate fields are overwritten)
    // and send back the response
    .then(results => {
      const merged = req.body.map((address, i) => Object.assign({}, address, emptyResponse, results[i]))
      switch (format || req.accepts(['csv', 'json'])) {
        case 'csv':
          res.type('csv')
          res.send(csv({ data: merged, hasCSVColumnTitle: true }))
          break
        case 'json':
          res.json(merged)
          break
      }
    })
    .catch(err => res.status(500).end(`${err}`))
})

// be nice and clean up after yourself
process.on('exit', _ => app.db && typeof app.db.close === 'function' && app.db.close())

// start server if called from cli, otherwise export
if (module.parent) {
  module.exports = app
} else {
  app.listen(PORT, _ => console.log(`Server running on ${PORT}`))
}
