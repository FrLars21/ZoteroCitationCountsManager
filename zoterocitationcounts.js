ZoteroCitationCounts = {
  _initialized: false,

  pluginID: null,
  pluginVersion: null,
  rootURI: null,

  l10n: null,
  APIs: [],

  /**
   * Track injected XULelements for removal upon mainWindowUnload.
   */
  _addedElementIDs: [],

  _log(msg) {
    Zotero.debug("Zotero Citation Counts: " + msg);
  },

  init: function ({ id, version, rootURI }) {
    if (this._initialized) return;

    this.pluginID = id;
    this.pluginVersion = version;
    this.rootURI = rootURI;

    this.l10n = new Localization(["citation-counts.ftl"]);

    /**
     * To add a new API:
     * -----------------
     * (1) Create a urlBuilder method on the ZoteroCitationCounts object. Args: urlencoded *id* and *idtype* ("doi" or "arxiv"). Return: URL for API request.
     *
     * (2) Create a responseCallback method on the ZoteroCitationCounts object. Args: *response* from api call. Return: citation count number.
     *
     * (3) Register the API here, and specify whether it works with doi, arxiv id or both.
     *
     * (4) for now, you also need to register the APIs key and name in "preferences.js" (important that they match the keys and names from below).
     */
    this.APIs = [
      {
        key: "crossref",
        name: "Crossref",
        useDoi: true,
        useArxiv: false,
        methods: {
          urlBuilder: this._crossrefUrl,
          responseCallback: this._crossrefCallback,
        },
      },
      {
        key: "inspire",
        name: "INSPIRE-HEP",
        useDoi: true,
        useArxiv: true,
        methods: {
          urlBuilder: this._inspireUrl,
          responseCallback: this._inspireCallback,
        },
      },
      {
        key: "semanticscholar",
        name: "Semantic Scholar",
        useDoi: true,
        useArxiv: true,
        methods: {
          urlBuilder: this._semanticScholarUrl,
          responseCallback: this._semanticScholarCallback,
        },
      },
    ];

    this._initialized = true;
  },

  getCitationCount: function (item) {
    const extraFieldLines = (item.getField("extra") || "")
      .split("\n")
      .filter((line) => /^Citations:|^\d+ citations/i.test(line));

    return extraFieldLines[0]?.match(/^\d+/) || "-";
  },

  getPref: function (pref) {
    return Zotero.Prefs.get("extensions.citationcounts." + pref, true);
  },

  setPref: function (pref, value) {
    return Zotero.Prefs.set("extensions.citationcounts." + pref, value, true);
  },

  icon: function (iconName, hiDPI) {
    return `chrome://zotero/skin/${iconName}${
      hiDPI ? (Zotero.hiDPI ? "@2x" : "") : ""
    }.png`;
  },

  /////////////////////////////////////////////
  //            UI related stuff             //
  ////////////////////////////////////////////

  /**
   * Create XULElement, set it's attributes, inject accordingly to the DOM & save a reference for later removal.
   *
   * @param {Document} document - "Document"-interface to be operated on.
   * @param {String} elementType - XULElement type (e.g. "menu", "popupmenu" etc.)
   * @param {String} elementID - The elements *unique* ID attribute.
   * @param {Object} elementAttributes - An object of key-value pairs that represent the DOM element attributes.
   * @param {String} parentID - The *unique* ID attribute of the element's parent element.
   * @param {Object} eventListeners - An object where keys are event types (e.g., 'command') and values are corresponding event handler functions.
   *
   * @returns {MozXULElement} - A reference to the injected XULElement.
   */
  _injectXULElement: function (
    document,
    elementType,
    elementID,
    elementAttributes,
    parentID,
    eventListeners
  ) {
    const element = document.createXULElement(elementType);
    element.id = elementID;

    Object.entries(elementAttributes || {})
      .filter(([_, value]) => value !== null && value !== undefined)
      .forEach(([key, value]) => element.setAttribute(key, value));

    Object.entries(eventListeners || {}).forEach(([eventType, listener]) => {
      element.addEventListener(eventType, listener);
    });

    document.getElementById(parentID).appendChild(element);
    this._storeAddedElement(element);

    return element;
  },

  _storeAddedElement: function (elem) {
    if (!elem.id) {
      throw new Error("Element must have an id.");
    }

    this._addedElementIDs.push(elem.id);
  },

  /**
   * Create a submenu to Zotero's "Tools"-menu, from which the plugin specific "autoretrieve" preference can be set.
   */
  _createToolsMenu: function (document) {
    const menu = this._injectXULElement(
      document,
      "menu",
      "menu_Tools-citationcounts-menu",
      { "data-l10n-id": "citationcounts-menutools-autoretrieve-title" },
      "menu_ToolsPopup"
    );

    const menupopup = this._injectXULElement(
      document,
      "menupopup",
      "menu_Tools-citationcounts-menu-popup",
      {},
      menu.id,
      {
        popupshowing: () => {
          this.APIs.concat({ key: "none" }).forEach((api) => {
            document
              .getElementById(`menu_Tools-citationcounts-menu-popup-${api.key}`)
              .setAttribute(
                "checked",
                Boolean(this.getPref("autoretrieve") === api.key)
              );
          });
        },
      }
    );

    this.APIs.concat({ key: "none" }).forEach((api) => {
      const label =
        api.key === "none"
          ? { "data-l10n-id": "citationcounts-menutools-autoretrieve-api-none" }
          : {
              "data-l10n-id": "citationcounts-menutools-autoretrieve-api",
              "data-l10n-args": `{"api": "${api.name}"}`,
            };

      this._injectXULElement(
        document,
        "menuitem",
        `menu_Tools-citationcounts-menu-popup-${api.key}`,
        {
          ...label,
          type: "checkbox",
        },
        menupopup.id,
        { command: () => this.setPref("autoretrieve", api.key) }
      );
    });
  },

  /**
   * Create a submenu to Zotero's "Item"-context menu, from which citation counts for selected items can be manually retrieved.
   */
  _createItemMenu: function (document) {
    const menu = this._injectXULElement(
      document,
      "menu",
      "zotero-itemmenu-citationcounts-menu",
      {
        "data-l10n-id": "citationcounts-itemmenu-retrieve-title",
        class: "menu-iconic",
      },
      "zotero-itemmenu"
    );

    const menupopup = this._injectXULElement(
      document,
      "menupopup",
      "zotero-itemmenu-citationcounts-menupopup",
      {},
      menu.id
    );

    this.APIs.forEach((api) => {
      this._injectXULElement(
        document,
        "menuitem",
        `zotero-itemmenu-citationcounts-${api.key}`,
        {
          "data-l10n-id": "citationcounts-itemmenu-retrieve-api",
          "data-l10n-args": `{"api": "${api.name}"}`,
        },
        menupopup.id,
        {
          command: () =>
            this.updateItems(
              Zotero.getActiveZoteroPane().getSelectedItems(),
              api
            ),
        }
      );
    });
  },

  /**
   * Inject plugin specific DOM elements in a DOM window.
   */
  addToWindow: function (window) {
    window.MozXULElement.insertFTLIfNeeded("citation-counts.ftl");

    this._createToolsMenu(window.document);
    this._createItemMenu(window.document);
  },

  /**
   * Inject plugin specific DOM elements into all Zotero windows.
   */
  addToAllWindows: function () {
    const windows = Zotero.getMainWindows();

    for (let window of windows) {
      if (!window.ZoteroPane) continue;
      this.addToWindow(window);
    }
  },

  /**
   * Remove plugin specific DOM elements from a DOM window.
   */
  removeFromWindow: function (window) {
    const document = window.document;

    for (let id of this._addedElementIDs) {
      document.getElementById(id)?.remove();
    }

    document.querySelector('[href="citation-counts.ftl"]').remove();
  },

  /**
   * Remove plugin specific DOM elements from all Zotero windows.
   */
  removeFromAllWindows: function () {
    const windows = Zotero.getMainWindows();

    for (let window of windows) {
      if (!window.ZoteroPane) continue;
      this.removeFromWindow(window);
    }
  },

  //////////////////////////////////////////////////////////
  //      Update citation count operation stuff          //
  /////////////////////////////////////////////////////////

  /**
   * Start citation count retrieval operation
   */
  updateItems: async function (itemsRaw, api) {
    const items = itemsRaw.filter((item) => !item.isFeedItem);
    if (!items.length) return;

    const progressWindow = new Zotero.ProgressWindow();
    progressWindow.changeHeadline(
      await this.l10n.formatValue("citationcounts-progresswindow-headline", {
        api: api.name,
      }),
      this.icon("toolbar-advanced-search")
    );

    const progressWindowItems = [];
    const itemTitles = items.map((item) => item.getField("title"));
    itemTitles.forEach((title) => {
      progressWindowItems.push(
        new progressWindow.ItemProgress(this.icon("spinner-16px"), title)
      );
    });

    progressWindow.show();

    this._updateItem(0, items, api, progressWindow, progressWindowItems);
  },

  /**
   * Updates citation counts recursively for a list of items.
   *
   * @param currentItemIndex - Index of currently updating Item. Zero-based.
   * @param items - List of all Items to be updated in this operation.
   * @param api - API to be used to retrieve *items* citation counts.
   * @param progressWindow - ProgressWindow associated with this operation.
   * @param progressWindowItems - List of references to each Zotero.ItemProgress in *progressWindow*.
   */
  _updateItem: async function (
    currentItemIndex,
    items,
    api,
    progressWindow,
    progressWindowItems
  ) {
    // Check if operation is done
    if (currentItemIndex >= items.length) {
      const headlineFinished = await this.l10n.formatValue(
        "citationcounts-progresswindow-finished-headline",
        { api: api.name }
      );
      progressWindow.changeHeadline(headlineFinished);
      progressWindow.startCloseTimer(5000);
      return;
    }

    const item = items[currentItemIndex];
    const pwItem = progressWindowItems[currentItemIndex];

    try {
      const [count, source] = await this._retrieveCitationCount(
        item,
        api.name,
        api.useDoi,
        api.useArxiv,
        api.methods.urlBuilder,
        api.methods.responseCallback
      );

      this._setCitationCount(item, source, count);

      pwItem.setIcon(this.icon("tick"));
      pwItem.setProgress(100);
    } catch (error) {
      pwItem.setError();
      new progressWindow.ItemProgress(
        this.icon("bullet_yellow"),
        await this.l10n.formatValue(error.message, { api: api.name }),
        pwItem
      );
    }

    this._updateItem(
      currentItemIndex + 1,
      items,
      api,
      progressWindow,
      progressWindowItems
    );
  },

  /**
   * Insert the retrieve citation count into the Items "extra" field.
   * Ref: https://www.zotero.org/support/kb/item_types_and_fields#citing_fields_from_extra
   */
  _setCitationCount: function (item, source, count) {
    const pattern = /^Citations \(${source}\):|^\d+ citations \(${source}\)/i;
    const extraFieldLines = (item.getField("extra") || "")
      .split("\n")
      .filter((line) => !pattern.test(line));

    const today = new Date().toISOString().split("T")[0];
    extraFieldLines.unshift(`${count} citations (${source}) [${today}]`);

    item.setField("extra", extraFieldLines.join("\n"));
    item.saveTx();
  },

  /**
   * Get the value of an items DOI field.
   * @TODO make more robust, e.g. try to extract DOI from url/extra field as well.
   */
  _getDoi: function (item) {
    const doi = item.getField("DOI");
    if (!doi) {
      throw new Error("citationcounts-progresswindow-error-no-doi");
    }

    return encodeURIComponent(doi);
  },

  /**
   * Get the value of an items arXiv field.
   * @TODO make more robust, e.g. try to extract arxiv id from extra field as well.
   */
  _getArxiv: function (item) {
    const itemURL = item.getField("url");
    const arxivMatch =
      /(?:arxiv.org[/]abs[/]|arXiv:)([a-z.-]+[/]\d+|\d+[.]\d+)/i.exec(itemURL);

    if (!arxivMatch) {
      throw new Error("citationcounts-progresswindow-error-no-arxiv");
    }

    return encodeURIComponent(arxivMatch[1]);
  },

  /**
   * Send a request to a specified url, handle response with specified callback, and return a validated integer.
   */
  _sendRequest: async function (url, callback) {
    const response = await fetch(url)
      .then((response) => response.json())
      .catch(() => {
        throw new Error("citationcounts-progresswindow-error-bad-api-response");
      });

    try {
      const count = parseInt(await callback(response));

      if (!(Number.isInteger(count) && count >= 0)) {
        // throw generic error since catch bloc will convert it.
        throw new Error();
      }

      return count;
    } catch (error) {
      throw new Error("citationcounts-progresswindow-error-no-citation-count");
    }
  },

  _retrieveCitationCount: async function (
    item,
    apiName,
    useDoi,
    useArxiv,
    urlFunction,
    requestCallback
  ) {
    let errorMessage = "";
    let doiField,
      arxivField = false;

    if (useDoi) {
      try {
        doiField = this._getDoi(item);

        const count = await this._sendRequest(
          urlFunction(doiField, "doi"),
          requestCallback
        );

        return [count, `${apiName}/DOI`];
      } catch (error) {
        errorMessage = error.message;
      }

      // if arxiv is not used, throw errors picked up along the way now.
      if (!useArxiv) {
        throw new Error(errorMessage);
      }
    }

    // If doi is not used for this api or if it is, but was unsuccessfull, and arxiv is used.
    if (useArxiv) {
      // save the error message from the doi operation.
      const doiErrorMessage = errorMessage;

      try {
        arxivField = this._getArxiv(item);

        const count = await this._sendRequest(
          urlFunction(arxivField, "arxiv"),
          requestCallback
        );

        return [count, `${apiName}/arXiv`];
      } catch (error) {
        errorMessage = error.message;
      }

      // if both no doi and no arxiv id on item
      if (useDoi && !doiField && !arxivField) {
        throw new Error("citationcounts-progresswindow-error-no-doi-or-arxiv");
      }

      // show proper error from unsuccessfull doi operation
      if (useDoi && !arxivField && doiErrorMessage) {
        throw new Error(doiErrorMessage);
      }

      // throw the last error incurred.
      throw new Error(errorMessage);
    }

    //if none is used, it is an internal error.
    throw new Error("citationcounts-internal-error");
  },

  /////////////////////////////////////////////
  //            API specific stuff           //
  ////////////////////////////////////////////

  _crossrefUrl: function (id, type) {
    return `https://api.crossref.org/works/${id}`;
  },

  _crossrefCallback: async function (response) {
    const count = response?.message?.["is-referenced-by-count"];

    // small delay to avoid hitting Crossref rate limits when
    // processing many items at once
    await new Promise((r) => setTimeout(r, 500));

    return count;
  },

  _inspireUrl: function (id, type) {
    return `https://inspirehep.net/api/${type}/${id}`;
  },

  _inspireCallback: function (response) {
    return response["metadata"]["citation_count"];
  },

  _semanticScholarUrl: function (id, type) {
    const prefix = type === "doi" ? "" : "arXiv:";
    return `https://api.semanticscholar.org/graph/v1/paper/${prefix}${id}?fields=citationCount`;
  },

  // The callback can be async if we want.
  _semanticScholarCallback: async function (response) {
    const count = response["citationCount"];

    // throttle Semantic Scholar so we don't reach limit.
    await new Promise((r) => setTimeout(r, 3000));
    return count;
  },
};
