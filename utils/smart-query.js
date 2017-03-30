/**
 * Given a query, runs it against the database and alters it slightly, multiple
 * times, until an unambiguous result is returned from the database or no
 * alterations are left.
 *
 * @param  {Object}
 * @return {Promise}
 */
module.exports = function smartQuery (query) {
  // first the obvious stuff:
  // - everything is trimmed
  for (let k of Object.keys(query)) if (typeof query[k] === 'string') query[k] = query[k].trim()

  if (query.str_hnr != null) {
    // - if a street + housenr is comined with an ending letter, it's always
    //   uppercased in the database
    query.str_hnr = query.str_hnr.replace(
      /(.*)?([0-9][a-z])$/, (_, ...matches) => matches[0] + matches[1].toUpperCase()
    )

    // - if we have a word ending with "strasse", it's spelled "straße"
    query.str_hnr = query.str_hnr.replace(/\b(Strasse|Str\.)\b/, 'Straße').replace(/(strasse|str\.)\b/, 'strasse')

    // - if we have sequences of housnrs (Karl-Marx-Straße 4-8), we take only the first number
    query.str_hnr = query.str_hnr.replace(/\b(\d+)-(\d+)$/, '$1')
  }

  // correct spelling of "strasse" is "straße", see above
  if (query.strasse != null) {
    query.strasse = query.strasse.replace(/\b(Strasse|Str\.)\b/, 'Straße').replace(/(strasse|str\.)\b/, 'strasse')
  }

  return query
}
