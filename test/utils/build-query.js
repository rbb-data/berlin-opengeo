/* eslint-env mocha */
const { expect } = require('chai')
const buildQuery = require('../../utils/build-query')

const { exactProps, fuzzyProps } = require('../../config')
const props = exactProps.concat(fuzzyProps)
const row = {
  'Strassenname': 'Kurfürstendamm',
  'Postleitzahl': '10719'
}
const representation = {
  'strasse': 'Strassenname',
  'plz': 'Postleitzahl'
}

describe('buildQuery', function () {
  it('should build a query given a row, a representation and available properties', function () {
    const query = buildQuery(row, representation, props)
    expect(query).to.deep.equal({ strasse: 'Kurfürstendamm', 'plz': '10719' })
  })

  it('should omit unavailable properties', function () {
    expect(buildQuery(row, representation, [])).to.deep.equal({})
    expect(buildQuery(row, representation, ['strasse'])).to.deep.equal({ 'strasse': 'Kurfürstendamm' })
  })
})
