const {
  PORT = 9000,
  DB_URL = 'mongodb://localhost:27017/geocoder',
  DB_COLLECTION = 'data'
} = process.env

const express = require('express')
const morgan = require('morgan')
const { MongoClient } = require('mongodb')

const app = express()
app.set('query parser', 'simple')
app.use(morgan('short'))

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
const allProps = fuzzyProps.concat(exactProps).sort()

function handleQuery (req, res, next) {
  // valid criteria
  const query = {}
  for (let field of allProps) {
    if (req.query[field]) query[field] = req.query[field]
  }

  // filter by at least one criterium
  if (!Object.keys(query).length) {
    const fields = allProps
      .map(prop => `  - ${prop}${fuzzyProps.indexOf(prop) !== -1 ? ' (fuzzy)' : ''}`)
      .join('\n')
    return res.status(400).send(`Please enter at least one of the following filters: ${'\n' + fields}`)
  }

  // enable partial matching for string queries
  for (let q of Object.keys(query)) {
    if (fuzzyProps.indexOf(q) !== -1) {
      query[q] = new RegExp(query[q])
    }
  }

  // enable users to filter returned properties by appending them to the URL,
  // separated by comma. No filter means all propertes.
  // Unknown properties are ignored.
  const props = {}
  const requestedProps = (req.params.props ? req.params.props.split(',') : allProps)
    .filter(prop => allProps.indexOf(prop) !== -1)
  for (let p of requestedProps) {
    props[p] = 1
  }

  // simsalabim 🔮
  app.db.find(query, props).toArray((err, docs) => {
    if (err) {
      return res.status(500).send(err.message)
    }

    res.json(docs)
    next()
  })
}

app.get('/', handleQuery)
app.get('/:props', handleQuery)

// start server if called from cli, otherwise export
if (module.parent) {
  module.exports = app
} else {
  app.listen(PORT, _ => console.log(`Server running on ${PORT}`))
}
