let ZoteroCitationCounts, itemObserver;

async function startup({ id, version, rootURI }) {
  Services.scriptloader.loadSubScript(rootURI + "zoterocitationcounts.js");

  ZoteroCitationCounts.init({ id, version, rootURI });
  ZoteroCitationCounts.addToAllWindows();

  Zotero.PreferencePanes.register({
    pluginID: id,
    label: await ZoteroCitationCounts.l10n.formatValue(
      "citationcounts-preference-pane-label"
    ),
    image: ZoteroCitationCounts.icon("edit-list-order", false),
    src: "preferences.xhtml",
    scripts: ["preferences.js"],
  });

  await Zotero.ItemTreeManager.registerColumns({
    dataKey: "citationcounts",
    label: await ZoteroCitationCounts.l10n.formatValue(
      "citationcounts-column-title"
    ),
    pluginID: id,
    flex: 0,
    width: 100,
    minWidth: 45,
    staticWidth: true,
    dataProvider: (item) => ZoteroCitationCounts.getCitationCount(item),
    zoteroPersist: ['width', 'hidden', 'sortDirection'],  // persist the column properties
  });

  itemObserver = Zotero.Notifier.registerObserver(
    {
      notify: function (event, type, ids, extraData) {
        if (event == "add") {
          const pref = ZoteroCitationCounts.getPref("autoretrieve");
          if (pref === "none") return;

          const api = ZoteroCitationCounts.APIs.find((api) => api.key === pref);
          if (!api) return;

          ZoteroCitationCounts.updateItems(Zotero.Items.get(ids), api);
        }
      },
    },
    ["item"]
  );
}

function onMainWindowLoad({ window }) {
  ZoteroCitationCounts.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  ZoteroCitationCounts.removeFromWindow(window);
}

function shutdown() {
  ZoteroCitationCounts.removeFromAllWindows();
  Zotero.Notifier.unregisterObserver(itemObserver);
  ZoteroCitationCounts = undefined;
}
