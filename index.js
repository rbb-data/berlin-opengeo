const {
  PORT = 9000,
  DB_URL = 'mongodb://localhost:21017/geocoder',
  DB_COLLECTION = 'data',
  QUERY_LIMIT = 0
} = process.env

const util = require('util') // eslint-disable-line no-unused-vars

const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const bodyParser = require('body-parser')

const { MongoClient } = require('mongodb')
const csv = require('json2csv')

const app = express()

// parse query strings
app.set('query parser', 'simple')

MongoClient.connect(DB_URL)
  .then(db => {
    app.db = db.collection(DB_COLLECTION)
    console.log(`Connected to database at ${DB_URL}`)
  })
  .catch(err => {
    console.error(err)
    return process.exit(1)
  })

// logging
app.use(morgan('short'))

// wildcard CORS header
app.use(cors())

// parse JSON POST bodies
app.use(bodyParser.json({ limit: '5mb' }))

const fuzzyProps = [
  'bezirk', 'finanzamt', 'karten', 'lor_bzr', 'lor_pgr', 'lor_plr', 'ortsteil', 'str_hnr',
  'strasse'
]

const exactProps = [
  'bezirk_nr', 'einschulungsbezirk', 'etrs89_hoch', 'etrs89_rechts',
  'finanzamt_nr', 'hnr', 'hnr_2', 'lat', 'lon', 'lor_bzr', 'lor_bzr_nr',
  'lor_pgr_nr', 'lor_plr_nr', 'mittelbereich', 'ortsteil_nr', 'plz',
  'soldner_hoch', 'soldner_rechts', 'stat_block', 'stat_gebaeude',
  'strassen_nr', 'strassenabschnitt', 'verkehrsflaeche', 'verkehrsteilflaeche'
]
const metaProps = [
  'limit', 'format', 'fuzzy'
]
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
    for (let k in query) {
      if (query.hasOwnProperty(k) && fuzzyProps.indexOf(k) !== -1) {
        query[k] = new RegExp(query[k])
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
  const fuzzy = req.query.fuzzy || '0'

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

  // we geocode the adresses by keeping the objects "as they are", and merge
  // them with the requested properties from the database
  Promise.all(
    req.body.map(address => {
      // build the query for each adress in the object
      let query = {}
      for (let rep in representation) {
        // if (address[representation[rep]] == null || address[representation[rep]] === '') {}
          // Skip rows where one or more fields that have a representation are (i.e. are queried for)
          // are empty to have more predicatable results
          // return Promise.resolve(emptyResponse)
        // }

        if (representation.hasOwnProperty(rep) && allProps.indexOf(rep) !== -1) {
          query[rep] = address[representation[rep]]
        }
      }

      // enable fuzzy matching if requested
      if (fuzzy === '1') {
        for (let k in query) {
          if (query.hasOwnProperty(k)) query[k] = new RegExp(query[k])
        }
      }

      return app.db.findOne(query, projection)
    }))
    .then(results => {
      // merge original field with our results, where duplicate fields are overwritten
      const merged = req.body.map((address, i) => Object.assign({}, address, results[i]))
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
process.on('exit', _ => app.db.close())

// start server if called from cli, otherwise export
if (module.parent) {
  module.exports = app
} else {
  app.listen(PORT, _ => console.log(`Server running on ${PORT}`))
}
