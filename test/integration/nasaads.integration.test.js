const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

// Helper function from the subtask description
function createMockItem(doi, extraContent = "", arxivId = null, url = null) {
  const item = {
    _DOI: doi,
    _extra: extraContent,
    _arxivId: arxivId,
    _url: url,
    getField: sinon.stub(),
    setField: sinon.stub(),
    saveTx: sinon.stub().resolves(),
    isFeedItem: false,
    // A simple way to identify items for debugging tests
    id: doi || arxivId || `item-${Math.random().toString(36).substr(2, 9)}`,
  };
  item.getField.withArgs('DOI').returns(item._DOI);
  item.getField.withArgs('extra').returns(item._extra);
  item.getField.withArgs('url').returns(item._url); // For _getArxiv
  // If your _getArxiv logic is more complex, adjust this stub or add more specific ones.
  // For example, if it parses arXiv ID from the 'extra' field as a fallback:
  // item.getField.withArgs('extra').returns(item._extra); 
  return item;
}


describe('ZoteroCitationCounts - NASA ADS Integration Tests', function() {
  let zccCode;
  let mockZoteroPane;
  let mockProgressWindowInstance;
  let mockItemProgressInstance;
  let mockGetSelectedItems;
  let originalDateToISOString;

  beforeEach(function() {
    // Mock Zotero.ProgressWindow.ItemProgress first as it's a constructor used by Zotero.ProgressWindow
    mockItemProgressInstance = {
      setIcon: sinon.stub(),
      setText: sinon.stub(),
      setProgress: sinon.stub(),
      setError: sinon.stub(),
      // Mock any other methods that might be called on an ItemProgress instance
    };
    const MockItemProgressConstructor = sinon.stub().returns(mockItemProgressInstance);

    // Mock Zotero.ProgressWindow
    mockProgressWindowInstance = {
      changeHeadline: sinon.stub(),
      show: sinon.stub(),
      ItemProgress: MockItemProgressConstructor, // Assign the mocked constructor
      startCloseTimer: sinon.stub(),
    };
    const MockProgressWindowConstructor = sinon.stub().returns(mockProgressWindowInstance);

    // Mock Zotero pane
    mockGetSelectedItems = sinon.stub();
    mockZoteroPane = {
      getSelectedItems: mockGetSelectedItems,
    };

    // Mock global Zotero object
    global.Zotero = {
      Prefs: {
        get: sinon.stub(),
        set: sinon.stub(),
      },
      debug: sinon.stub(), // For ZoteroCitationCounts._log
      ProgressWindow: MockProgressWindowConstructor,
      getActiveZoteroPane: sinon.stub().returns(mockZoteroPane),
      // Mock Localization (L10n)
      // ZoteroCitationCounts.l10n is initialized with `new Localization(["citation-counts.ftl"]);`
      // We need to mock the constructor and its methods if used, or mock the instance directly after script load.
      Localization: sinon.stub().returnsThis(), // Make constructor return 'this'
      // Then mock methods on 'this' or on the instance if it's assigned (e.g., Zotero.L10n.formatValue)
      // For simplicity, we'll mock formatValue on ZoteroCitationCounts.l10n after script load.
      
      // other necessary Zotero mocks
      hiDPI: false, // For ZoteroCitationCounts.icon
    };
    
    // Mock global.fetch
    sinon.stub(global, 'fetch');

    // Mock Date.prototype.toISOString to control date strings
    const constantDate = new Date('2023-01-01T12:00:00.000Z');
    originalDateToISOString = Date.prototype.toISOString;
    Date.prototype.toISOString = sinon.stub().returns(constantDate.toISOString());


    // Load ZoteroCitationCounts script
    if (!zccCode) {
      zccCode = fs.readFileSync(path.join(__dirname, '../../src/zoterocitationcounts.js'), 'utf-8');
    }
    // Inject Zotero mock into the script's scope
    new Function('Zotero', zccCode)(global.Zotero);
    
    // Now that ZoteroCitationCounts is loaded and has its l10n instance, mock its formatValue
    if (global.ZoteroCitationCounts && global.ZoteroCitationCounts.l10n) {
      global.ZoteroCitationCounts.l10n.formatValue = sinon.stub().resolvesArg(0);
    } else {
      // Fallback if l10n is not on ZoteroCitationCounts but on Zotero.L10n instance
      global.Zotero.L10n = { // Assuming L10n might be used as Zotero.L10n
          formatValue: sinon.stub().resolvesArg(0)
      };
    }
    // The init function is called during script load. APIs should be populated.
    // Ensure ZoteroCitationCounts.init has been called
    if (global.ZoteroCitationCounts && !global.ZoteroCitationCounts._initialized) {
        global.ZoteroCitationCounts.init({ id: 'test-id', version: 'test-version', rootURI: 'test-uri/'});
    }


  });

  afterEach(function() {
    sinon.restore(); // Restores all sinon stubs and mocks
    if (global.fetch && global.fetch.restore) {
        global.fetch.restore(); // Specifically restore fetch if it was stubbed
    }
    Date.prototype.toISOString = originalDateToISOString; // Restore original toISOString
    delete global.Zotero;
    delete global.ZoteroCitationCounts; // Clean up global scope
  });

  // Test Scenarios will go here
  describe('NASA ADS Scenarios', function() {
    let nasaAdsApiObject;
    let mockItems;

    beforeEach(function() {
      // Find NASA ADS API object
      nasaAdsApiObject = global.ZoteroCitationCounts.APIs.find(api => api.key === 'nasaads');
      expect(nasaAdsApiObject, "NASA ADS API object not found").to.exist;
    });

    it('Scenario 1: Successful fetch and update for NASA ADS (DOI)', async function() {
      const mockItem = createMockItem('10.1234/test.doi');
      mockItems = [mockItem];
      mockGetSelectedItems.returns(mockItems);
      global.Zotero.Prefs.get.withArgs('extensions.citationcounts.nasaadsApiKey', true).returns('TEST_KEY');
      
      global.fetch.resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({ response: { docs: [{ citation_count: 42 }] } }),
      });

      await global.ZoteroCitationCounts.updateItems(mockItems, nasaAdsApiObject);
      
      expect(global.fetch.calledOnce).to.be.true;
      const fetchCall = global.fetch.getCall(0);
      expect(fetchCall.args[0]).to.include('https://api.adsabs.harvard.edu/v1/search/query');
      expect(fetchCall.args[0]).to.include('q=doi:10.1234%2Ftest.doi'); // URI encoded
      expect(fetchCall.args[0]).to.include('api_key=TEST_KEY');
      
      expect(mockItem.setField.calledOnceWith('extra', '42 citations (NASA ADS/DOI) [2023-01-01]\n')).to.be.true;
      expect(mockItem.saveTx.calledOnce).to.be.true;
      
      expect(mockProgressWindowInstance.ItemProgress.calledOnce).to.be.true;
      expect(mockItemProgressInstance.setIcon.calledWith(sinon.match(/tick/))).to.be.true; // Or specific icon path
      expect(mockItemProgressInstance.setProgress.calledWith(100)).to.be.true;

      // Verify l10n calls for progress window headlines
      expect(global.ZoteroCitationCounts.l10n.formatValue.calledWith('citationcounts-progresswindow-headline', { api: 'NASA ADS' })).to.be.true;
      expect(global.ZoteroCitationCounts.l10n.formatValue.calledWith('citationcounts-progresswindow-finished-headline', { api: 'NASA ADS' })).to.be.true;
    });

    it('Scenario 2: NASA ADS API key error (401)', async function() {
      const mockItem = createMockItem('10.1234/another.doi');
      mockItems = [mockItem];
      mockGetSelectedItems.returns(mockItems);
      global.Zotero.Prefs.get.withArgs('extensions.citationcounts.nasaadsApiKey', true).returns('WRONG_KEY');

      global.fetch.resolves({
        ok: false,
        status: 401,
        url: 'https://api.adsabs.harvard.edu/v1/search/query?q=doi:10.1234%2Fanother.doi&fl=citation_count&api_key=WRONG_KEY',
      });

      await global.ZoteroCitationCounts.updateItems(mockItems, nasaAdsApiObject);

      expect(global.fetch.calledOnce).to.be.true;
      expect(mockItem.setField.called).to.be.false; // No citation update
      expect(mockItem.saveTx.called).to.be.false;

      expect(mockProgressWindowInstance.ItemProgress.calledOnce).to.be.true;
      expect(mockItemProgressInstance.setError.calledOnce).to.be.true;
      
      // Check that l10n was called to format the specific error message for the ProgressWindow item
      // The error message itself is added as a new ItemProgress, so we check the text of that new ItemProgress
      // This means ItemProgress constructor should be called twice: once for the item, once for the error.
      expect(mockProgressWindowInstance.ItemProgress.calledTwice).to.be.true; // Original item + error item
      const errorItemProgressCall = mockProgressWindowInstance.ItemProgress.getCall(1); // Second call is for the error.
      expect(global.ZoteroCitationCounts.l10n.formatValue.calledWith('citationcounts-progresswindow-error-nasaads-apikey', { api: 'NASA ADS' })).to.be.true;
      // Check the text passed to the error ItemProgress constructor
      expect(errorItemProgressCall.args[1]).to.equal('citationcounts-progresswindow-error-nasaads-apikey'); 
    });

    it('Scenario 3: No DOI for NASA ADS (when DOI is the only identifier)', async function() {
      const mockItem = createMockItem(null); // No DOI
      mockItems = [mockItem];
      mockGetSelectedItems.returns(mockItems);
      // For this test, let's assume NASA ADS is configured to only use DOI or DOI is tried first.
      // The nasaAdsApiObject by default has useDoi: true, useArxiv: true.
      // To force this scenario, we can either:
      // 1. Temporarily modify nasaAdsApiObject.useArxiv = false (if the test setup allows deep copy or restoration)
      // 2. Ensure the mockItem doesn't have an arXiv ID either.
      // The current createMockItem creates it without arXiv unless specified.

      await global.ZoteroCitationCounts.updateItems(mockItems, nasaAdsApiObject);

      expect(global.fetch.called).to.be.false; // Fetch should not be called if DOI is missing and it's the primary/only ID
      expect(mockItem.setField.called).to.be.false;
      expect(mockItem.saveTx.called).to.be.false;

      expect(mockProgressWindowInstance.ItemProgress.calledOnce).to.be.true; // For the item itself
      expect(mockItemProgressInstance.setError.calledOnce).to.be.true;

      // Check for the "no DOI" error message.
      expect(mockProgressWindowInstance.ItemProgress.calledTwice).to.be.true; // Original item + error item
      const errorItemProgressCall = mockProgressWindowInstance.ItemProgress.getCall(1);
      expect(global.ZoteroCitationCounts.l10n.formatValue.calledWith('citationcounts-progresswindow-error-no-doi', { api: 'NASA ADS' })).to.be.true;
      expect(errorItemProgressCall.args[1]).to.equal('citationcounts-progresswindow-error-no-doi');
    });
  });
});
