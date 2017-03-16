const {
  PORT = 9000,
  DB_URL = 'mongodb://localhost:21017/geocoder',
  DB_COLLECTION = 'data',
  QUERY_LIMIT = 0
} = process.env

const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const { MongoClient } = require('mongodb')
const csv = require('json2csv')

const app = express()
app.set('query parser', 'simple')
app.use(morgan('short'))
app.use(cors())

MongoClient.connect(DB_URL, (err, db) => {
  if (err) {
    console.error(err)
    return process.exit(1)
  }

  app.db = db.collection(DB_COLLECTION)
  console.log(`Connected to database at ${DB_URL}`)
})

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
 * Route to return all possible matches for a single adress
 */
app.get(['/', '/:props'], function handleSingleAddress (req, res, next) {
  // build up database query from request's query parameters
  let meta = {
    'limit': QUERY_LIMIT,
    'format': undefined,
    'fuzzy': '1'
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

  // enable partial matching for string queries
  if (meta.fuzzy !== '0') {
    for (let q of Object.keys(query)) {
      if (fuzzyProps.indexOf(q) !== -1) {
        query[q] = new RegExp(query[q])
      }
    }
  }

  // enable users to filter returned properties by appending them to the URL,
  // separated by comma. No filter means all propertes.
  // Unknown properties are ignored.
  const requestedProps = (req.params.props ? req.params.props.split(',') : allProps)
    .filter(prop => allProps.indexOf(prop) !== -1)
  let props = {}
  for (let p of requestedProps) {
    props[p] = 1
  }

  // simsalabim 🔮
  const cursor = app.db.find(query, props)
    .limit(parseInt(meta.limit, 10))

  let firstResponse = true

  // use ?format= parameter or "Accepts" header
  switch (meta.format || req.accepts(['csv', 'json'])) {
    case 'csv':
      res.set({ 'content-type': 'text/csv; charset=utf-8' })
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
      res.set({ 'content-type': 'application/json; charset=utf-8' })
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
  }
})

// be nice and clean up after yourself
process.on('exit', _ => app.db.close())

// start server if called from cli, otherwise export
if (module.parent) {
  module.exports = app
} else {
  app.listen(PORT, _ => console.log(`Server running on ${PORT}`))
}
