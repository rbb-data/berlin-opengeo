/* eslint-env mocha */
const { expect } = require('chai')
const smarts = require('../../utils/smart-query')

describe('smarts', function () {
  it('should normalize straße, strasse and str. in the field str_hnr', function () {
    expect(smarts({ str_hnr: 'Potsdamer Platz 15' })).to.deep.equal({ str_hnr: 'Potsdamer Platz 15' })
    expect(smarts({ str_hnr: 'Oranienstrasse 1' })).to.deep.equal({ str_hnr: 'Oranienstraße 1' })
    expect(smarts({ str_hnr: 'Oranienstraße 11' })).to.deep.equal({ str_hnr: 'Oranienstraße 11' })
    expect(smarts({ str_hnr: 'Oranienstr.' })).to.deep.equal({ str_hnr: 'Oranienstraße' })
  })

  it('should normalize letters following a house number in the field str_hnr', function () {
    expect(smarts({ str_hnr: 'Elsenstraße 110c' })).to.deep.equal({ str_hnr: 'Elsenstraße 110C' })
    expect(smarts({ str_hnr: 'Kurfürstendamm 86 A' })).to.deep.equal({ str_hnr: 'Kurfürstendamm 86A' })
    expect(smarts({ str_hnr: 'Kurfürstendamm 86 a' })).to.deep.equal({ str_hnr: 'Kurfürstendamm 86A' })
  })

  it('should normalize straße, strasse and str. in the field strasse', function () {
    expect(smarts({ strasse: 'Berliner Platz' })).to.deep.equal({ strasse: 'Berliner Platz' })
    expect(smarts({ strasse: 'Oranienstraße' })).to.deep.equal({ strasse: 'Oranienstraße' })
    expect(smarts({ strasse: 'Kurfürstenstr.' })).to.deep.equal({ strasse: 'Kurfürstenstraße' })
    expect(smarts({ strasse: 'Seestrasse' })).to.deep.equal({ strasse: 'Seestraße' })
  })
})
