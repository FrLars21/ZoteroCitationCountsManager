# Zotero 8 Citation Counts Manager

- [GitHub](https://github.com/FrLars21/ZoteroCitationCountsManager): Source
  code repository

This is an add-on for [Zotero](https://www.zotero.org), a research source management tool. The add-on can auto-fetch citation counts for journal articles using various APIs, including [Crossref](https://www.crossref.org), [INSPIRE-HEP](https://inspirehep.net), and [Semantic Scholar](https://www.semanticscholar.org). [Google Scholar](https://scholar.google.com) is not supported because automated access is against its terms of service.

Please report any bugs, questions, or feature requests in the Github repository.

## Features

- Autoretrieve citation counts when a new item is added to your Zotero library.
- Retrieve citation counts manually by right-clicking on one or more items in your Zotero library.
- Works with the following APIs: [Crossref](https://www.crossref.org), [INSPIRE-HEP](https://inspirehep.net) and [Semantic Scholar](https://www.semanticscholar.org).
- _NEW:_ The plugin is compatible with **Zotero 8**.
- _NEW:_ The plugin registers a custom column ("Citation Counts") in your Zotero library so that items can be **ordered by citation count**.
- _NEW:_ Improved _citation count retrieval operation_ status reporting, including item-specific error messages for those items where a citation count couldn't be retrieved.
- _NEW:_ Concurrent citation count retrieval operations is now possible. Especially important for the autoretrieve feature.
- _NEW:_ Fluent is used for localizing, while the locale file has been simplified and now cover the whole plugin. You are welcome to submit translations as a PR.
- _NEW:_ The whole codebade has been refactored with a focus on easy maintenance, especially for the supported citation count APIs.

## Acknowledgements

This plugin is a refactored and enhanced version of Erik Schnetter's [Zotero Citations Counts Manager](https://github.com/eschnett/zotero-citationcounts). Code for that extension was based on [Zotero DOI Manager](https://github.com/bwiernik/zotero-shortdoi), which is based in part on [Zotero Google Scholar Citations](https://github.com/beloglazov/zotero-scholar-citations) by Anton Beloglazov.
Boilerplate for this plugin was based on Zotero's sample plugin for v7 [Make-It-Red](https://github.com/zotero/make-it-red).

## Installing

- Download the add-on (the .xpi file) from the latest release: https://github.com/FrLars21/ZoteroCitationCountsManager/releases
- To download the .xpi file, right click it and select 'Save link as'
- Run Zotero (version 8.x)
- Go to `Tools -> Add-ons`
- `Install Add-on From File`
- Choose the file `zoterocitationcountsmanager-2.1.xpi`
- Restart Zotero

## License

Distributed under the Mozilla Public License (MPL) Version 2.0.
