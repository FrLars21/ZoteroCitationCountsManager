ZoteroCitationCounts_Prefs = {
  /**
   * @TODO reference ZoteroCitationCounts.APIs directly.
   */
  APIs: [
    {
      key: "crossref",
      name: "Crossref",
    },
    {
      key: "inspire",
      name: "INSPIRE-HEP",
    },
    {
      key: "semanticscholar",
      name: "Semantic Scholar",
    },
  ],

  init: function () {
    this.APIs.concat({ key: "none" }).forEach((api) => {
      const label =
        api.key === "none"
          ? {
              "data-l10n-id":
                "citationcounts-preferences-pane-autoretrieve-api-none",
            }
          : {
              "data-l10n-id":
                "citationcounts-preferences-pane-autoretrieve-api",
              "data-l10n-args": `{"api": "${api.name}"}`,
            };

      this._injectXULElement(
        document,
        "radio",
        `citationcounts-preferences-pane-autoretrieve-radio-${api.key}`,
        {
          ...label,
          value: api.key,
        },
        "citationcounts-preference-pane-autoretrieve-radiogroup"
      );
    });
  },

  /**
   * @TODO reference ZoteroCitationCounts._injectXULElement directly.
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

    return element;
  },
};
