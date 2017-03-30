/**
 * Given a single row (an adress), a representation and all available
 * properties that can be queried for, this function returns an object that
 * can be used to query MongoDB for said address.
 *
 * @param  {Object} row                 An address from the csv, given in the
 *                                      form `{ "col": $val, ... }`
 * @param  {Object} representation      A representation given as an object
 *                                      that looks like { "str_hnr": $col_name }
 * @param  {Array}  retrievableProps    An array of strings of all properties
 * @return {Object}                     A MongoDB query
 */
module.exports = function populateQuery (row, representation, retrievableProps) {
  let query = {}
  for (let rep in representation) {
    if (representation.hasOwnProperty(rep) && retrievableProps.indexOf(rep) !== -1) {
      query[rep] = row[representation[rep]]
    }
  }
  return query
}
