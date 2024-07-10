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
    image: rootURI + 'icons/icon.png',
    src: "preferences.xhtml",
    scripts: ["preferences.js"],
  });

  await Zotero.ItemTreeManager.registerColumns({
    dataKey: "citationcounts",
    label: await ZoteroCitationCounts.l10n.formatValue(
      "citationcounts-column-title"
    ),
    pluginID: id,
    dataProvider: (item) => ZoteroCitationCounts.getCitationCount(item),
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

function uninstall() {

}

function install() {

}