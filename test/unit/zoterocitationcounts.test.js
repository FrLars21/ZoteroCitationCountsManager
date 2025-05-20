const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

describe('ZoteroCitationCounts', function() {
  let mockZoteroPrefsGet;
  let zccCode;

  beforeEach(function() {
    // Setup Zotero mock
    mockZoteroPrefsGet = sinon.stub();
    global.Zotero = {
      Prefs: {
        get: mockZoteroPrefsGet,
        // Add set stub if any tests require setting preferences
        set: sinon.stub() 
      },
      debug: sinon.stub(), // Mock for this._log
      // ... other necessary Zotero mocks
    };

    // Mock fetch
    sinon.stub(global, 'fetch');

    // Read the script content once
    if (!zccCode) {
      zccCode = fs.readFileSync(path.join(__dirname, '../../src/zoterocitationcounts.js'), 'utf-8');
    }
    
    // Execute the script content, making ZoteroCitationCounts available globally
    // and injecting the mocked Zotero object.
    // Using new Function to avoid direct eval and to pass Zotero as an argument.
    new Function('Zotero', zccCode)(global.Zotero);
    
    // Ensure that ZoteroCitationCounts.getPref is bound to the Zotero.Prefs.get mock for these tests
    // This is necessary because the original script uses 'this.getPref' internally for _nasaadsUrl
    // and 'this' inside _nasaadsUrl refers to ZoteroCitationCounts.
    // We need to ensure that ZoteroCitationCounts.getPref calls our stubbed Zotero.Prefs.get.
    // The ZoteroCitationCounts object is defined as an object literal, and its methods
    // like getPref are defined within that literal. When these methods are called,
    // 'this' correctly refers to ZoteroCitationCounts.
    // The 'getPref' method in ZoteroCitationCounts itself calls Zotero.Prefs.get,
    // which we have stubbed. So, direct assignment as below is not strictly needed
    // if the script structure ensures 'this' is ZoteroCitationCounts.
    // However, explicitly binding or ensuring the methods use the mocked global.Zotero
    // can be a good safeguard.
    // In this case, ZoteroCitationCounts.getPref will use global.Zotero.Prefs.get due to lexical scoping
    // or the way 'this' is resolved in the original script when it refers to Zotero.Prefs.get.
    // The new Function approach should make global.Zotero available to the script.
  });

  afterEach(function() {
    sinon.restore();
    if (global.fetch && global.fetch.restore) { // Ensure fetch was stubbed before trying to restore
        global.fetch.restore();
    }
    delete global.Zotero;
    delete global.ZoteroCitationCounts; // Clean up the global scope
  });

  describe('_nasaadsUrl', function() {
    it('should construct the correct URL with API key for DOI', function() {
      global.Zotero.Prefs.get.withArgs('extensions.citationcounts.nasaadsApiKey', true).returns('TEST_API_KEY');
      
      const id = '10.1000/xyz123';
      const type = 'doi';
      // Note: _nasaadsUrl uses this.getPref internally. We must ensure this.getPref uses the stubbed Zotero.Prefs.get.
      // The ZoteroCitationCounts object is directly available in the global scope after the new Function execution.
      const actualUrl = global.ZoteroCitationCounts._nasaadsUrl(id, type);
      const expectedUrl = `https://api.adsabs.harvard.edu/v1/search/query?q=doi:${id}&fl=citation_count&api_key=TEST_API_KEY`;
      expect(actualUrl).to.equal(expectedUrl);
    });

    it('should construct the correct URL with API key for arXiv', function() {
      global.Zotero.Prefs.get.withArgs('extensions.citationcounts.nasaadsApiKey', true).returns('TEST_API_KEY_ARXIV');
      
      const id = '2303.12345';
      const type = 'arxiv';
      const actualUrl = global.ZoteroCitationCounts._nasaadsUrl(id, type);
      const expectedUrl = `https://api.adsabs.harvard.edu/v1/search/query?q=arxiv:${id}&fl=citation_count&api_key=TEST_API_KEY_ARXIV`;
      expect(actualUrl).to.equal(expectedUrl);
    });

    it('should use an empty string if API key is not set', function() {
      global.Zotero.Prefs.get.withArgs('extensions.citationcounts.nasaadsApiKey', true).returns('');
      
      const id = '10.1000/abc789';
      const type = 'doi';
      const actualUrl = global.ZoteroCitationCounts._nasaadsUrl(id, type);
      const expectedUrl = `https://api.adsabs.harvard.edu/v1/search/query?q=doi:${id}&fl=citation_count&api_key=`;
      expect(actualUrl).to.equal(expectedUrl);
    });
  });
  
  describe('getPref', function() {
    it('should call Zotero.Prefs.get with the correct preference key', function() {
      // The ZoteroCitationCounts object is globally available.
      global.ZoteroCitationCounts.getPref('myTestPref');
      expect(global.Zotero.Prefs.get.calledOnceWith('extensions.citationcounts.myTestPref', true)).to.be.true;
    });

    it('should return the value from Zotero.Prefs.get', function() {
      global.Zotero.Prefs.get.withArgs('extensions.citationcounts.anotherPref', true).returns('expectedValue');
      const val = global.ZoteroCitationCounts.getPref('anotherPref');
      expect(val).to.equal('expectedValue');
    });
  });

  describe('_sendRequest', function() {
    const nasaAdsUrl = 'https://api.adsabs.harvard.edu/v1/search/query?q=doi:anything&api_key=SOMEKEY';
    const otherApiUrl = 'https://api.anotherexample.com/data';
    let mockCallback;

    beforeEach(function() {
      mockCallback = sinon.stub();
    });

    it('should throw nasaads-apikey error for NASA ADS 401 response', async function() {
      global.fetch.resolves({
        ok: false,
        status: 401,
        url: nasaAdsUrl 
      });

      let actualError = null;
      try {
        await global.ZoteroCitationCounts._sendRequest(nasaAdsUrl, mockCallback);
      } catch (e) {
        actualError = e;
      }
      expect(actualError).to.be.an('Error');
      expect(actualError.message).to.equal('citationcounts-progresswindow-error-nasaads-apikey');
      expect(global.Zotero.debug.calledWith(sinon.match(/NASA ADS API key error/))).to.be.true;
    });

    it('should throw nasaads-apikey error for NASA ADS 403 response', async function() {
      global.fetch.resolves({
        ok: false,
        status: 403,
        url: nasaAdsUrl
      });

      let actualError = null;
      try {
        await global.ZoteroCitationCounts._sendRequest(nasaAdsUrl, mockCallback);
      } catch (e) {
        actualError = e;
      }
      expect(actualError).to.be.an('Error');
      expect(actualError.message).to.equal('citationcounts-progresswindow-error-nasaads-apikey');
      expect(global.Zotero.debug.calledWith(sinon.match(/NASA ADS API key error/))).to.be.true;
    });

    it('should throw bad-api-response error for other NASA ADS errors (e.g., 500)', async function() {
      global.fetch.resolves({
        ok: false,
        status: 500,
        url: nasaAdsUrl
      });

      let actualError = null;
      try {
        await global.ZoteroCitationCounts._sendRequest(nasaAdsUrl, mockCallback);
      } catch (e) {
        actualError = e;
      }
      expect(actualError).to.be.an('Error');
      expect(actualError.message).to.equal('citationcounts-progresswindow-error-bad-api-response');
      expect(global.Zotero.debug.calledWith(sinon.match(/Bad API response for/))).to.be.true;
    });

    it('should throw bad-api-response error for non-NASA ADS API errors (e.g., 404)', async function() {
      global.fetch.resolves({
        ok: false,
        status: 404,
        url: otherApiUrl
      });

      let actualError = null;
      try {
        await global.ZoteroCitationCounts._sendRequest(otherApiUrl, mockCallback);
      } catch (e) {
        actualError = e;
      }
      expect(actualError).to.be.an('Error');
      expect(actualError.message).to.equal('citationcounts-progresswindow-error-bad-api-response');
      expect(global.Zotero.debug.calledWith(sinon.match(/Bad API response for/))).to.be.true;
    });

    it('should throw bad-api-response error for network failures', async function() {
      global.fetch.rejects(new Error('Network failure'));

      let actualError = null;
      try {
        await global.ZoteroCitationCounts._sendRequest(otherApiUrl, mockCallback);
      } catch (e) {
        actualError = e;
      }
      expect(actualError).to.be.an('Error');
      expect(actualError.message).to.equal('citationcounts-progresswindow-error-bad-api-response');
      expect(global.Zotero.debug.calledWith(sinon.match(/Network error fetching/))).to.be.true;
    });

    it('should return count for successful response and valid count', async function() {
      const mockResponseData = { some_count_field: 123 };
      global.fetch.resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves(mockResponseData)
      });
      mockCallback.returns(mockResponseData.some_count_field);

      const count = await global.ZoteroCitationCounts._sendRequest(otherApiUrl, mockCallback);
      expect(count).to.equal(123);
      expect(mockCallback.calledWith(mockResponseData)).to.be.true;
    });

    it('should throw no-citation-count error for successful response but invalid count (string)', async function() {
      const mockResponseData = { some_count_field: "not-a-number" };
      global.fetch.resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves(mockResponseData)
      });
      mockCallback.returns(mockResponseData.some_count_field);

      let actualError = null;
      try {
        await global.ZoteroCitationCounts._sendRequest(otherApiUrl, mockCallback);
      } catch (e) {
        actualError = e;
      }
      expect(actualError).to.be.an('Error');
      expect(actualError.message).to.equal('citationcounts-progresswindow-error-no-citation-count');
      expect(global.Zotero.debug.calledWith(sinon.match(/Error processing API response/))).to.be.true;
    });
    
    it('should throw no-citation-count error for successful response but invalid count (negative)', async function() {
      const mockResponseData = { some_count_field: -5 };
      global.fetch.resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves(mockResponseData)
      });
      mockCallback.returns(mockResponseData.some_count_field);

      let actualError = null;
      try {
        await global.ZoteroCitationCounts._sendRequest(otherApiUrl, mockCallback);
      } catch (e) {
        actualError = e;
      }
      expect(actualError).to.be.an('Error');
      expect(actualError.message).to.equal('citationcounts-progresswindow-error-no-citation-count');
    });


    it('should throw no-citation-count error for successful response but malformed JSON', async function() {
      global.fetch.resolves({
        ok: true,
        status: 200,
        json: sinon.stub().rejects(new Error('JSON.parse: unexpected character at line 1 column 1 of the JSON data'))
      });

      let actualError = null;
      try {
        await global.ZoteroCitationCounts._sendRequest(otherApiUrl, mockCallback);
      } catch (e) {
        actualError = e;
      }
      expect(actualError).to.be.an('Error');
      expect(actualError.message).to.equal('citationcounts-progresswindow-error-no-citation-count');
      expect(global.Zotero.debug.calledWith(sinon.match(/Error processing API response/))).to.be.true;
    });
  });
});
