/**
 * Given a query, runs it against the database and alters it slightly, multiple
 * times, until an unambiguous result is returned from the database or no
 * alterations are left.
 *
 * @param  {Object}
 * @return {Promise}
 */
module.exports = function smartQuery (query) {
  const upperCaseStreet = /\b(Strasse|Str\.)(\b|$)/
  const lowerCaseStreet = /(strasse|str\.)(\b|$)/

  // first the obvious stuff:
  for (let k of Object.keys(query)) {
    // cast everything that's not latitude or longitude to a string
    if (k !== 'lat' && k !== 'lon') query[k] = String(query[k])

    // trim everything
    if (typeof query[k] === 'string') query[k] = query[k].trim()
  }

  if (query.str_hnr != null) {
    // - if a street + housenr is comined with an ending letter, it's always
    //   uppercased in the database
    query.str_hnr = query.str_hnr.replace(
      /(.*)?([0-9]\s*[a-z])$/, (_, ...matches) => matches[0] + matches[1].toUpperCase()
    )

    // - if a letter is following street + house number but has a space, remove the space
    query.str_hnr = query.str_hnr.replace(/\b([0-9]+)(\s+)([A-Z])$/, '$1$3')

    // - if we have a word ending with "strasse", it's spelled "straße"
    query.str_hnr = query.str_hnr.replace(upperCaseStreet, 'Straße').replace(lowerCaseStreet, 'straße')

    // - if we have sequences of housnrs (Karl-Marx-Straße 4-8), we take only the first number
    query.str_hnr = query.str_hnr.replace(/\b(\d+)-(\d+)$/, '$1')
  }

  // correct spelling of "strasse" is "straße", see above
  if (query.strasse != null) {
    query.strasse = query.strasse.replace(upperCaseStreet, 'Straße').replace(lowerCaseStreet, 'straße')
  }

  return query
}
