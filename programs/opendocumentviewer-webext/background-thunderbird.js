/**
 * Copyright (C) 2026 Daniel Berthereau <Daniel.git@Berthereau.net>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License (GNU AGPL) as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global messenger*/

// An attachment of a message never travels over http, it is a part of the
// message itself, so the way of the browsers, that watches the requests, does
// not reach it here. Thunderbird hands the attachment over as a file instead,
// and the viewer reads it from there, as it reads the file a reader picks.
//
// Thunderbird carries no api to answer for an attachment that is opened: what
// a double click on it runs is the program of the system the settings name,
// and no add-on may take that over. The document is opened from an entry of
// the menu of the attachment, and of the menu of a message that carries one.
// There is no button of its own in the header of a message: a button may be
// disabled but not hidden, and one that is grey on nearly every message is
// noise.
(function () {
    "use strict";

    var ID = "opendocumentviewer-open",
        // An entry without a title is an entry no reader sees, so the words
        // of the package answer for the ones of the locale when those are not
        // there.
        TITLE = messenger.i18n.getMessage("openInViewer")
            || "Open in OpenDocument Viewer",
        TYPES = [
            "application/vnd.oasis.opendocument.text",
            "application/vnd.oasis.opendocument.text-template",
            "application/vnd.oasis.opendocument.text-flat-xml",
            "application/vnd.oasis.opendocument.spreadsheet",
            "application/vnd.oasis.opendocument.spreadsheet-template",
            "application/vnd.oasis.opendocument.spreadsheet-flat-xml",
            "application/vnd.oasis.opendocument.presentation",
            "application/vnd.oasis.opendocument.presentation-template",
            "application/vnd.oasis.opendocument.presentation-flat-xml"
        ],
        EXTENSIONS = /\.(odt|ott|fodt|ods|ots|fods|odp|otp|fodp)$/i,
        // The languages the page of the welcome is written in, beside the
        // English one every other language falls on.
        LANGUAGES = ["en", "fr"],
        // The entries of the documents of a message, that are made anew each
        // time a menu is shown, and what each of them opens.
        children = [],
        documentsOfChildren = {};

    /**
     * @param {?Object} attachment
     * @return {!boolean}
     */
    function isDocument(attachment) {
        // A mail server that knows no OpenDocument sends the attachment as an
        // octet stream, so the name is read as well.
        if (!attachment) {
            return false;
        }
        if (TYPES.indexOf(attachment.contentType) !== -1) {
            return true;
        }
        return EXTENSIONS.test(String(attachment.name));
    }

    /**
     * @param {!Array.<!Object>} attachments
     * @return {?Object}
     */
    function firstDocument(attachments) {
        var i;
        for (i = 0; i < attachments.length; i += 1) {
            if (isDocument(attachments[i])) {
                return attachments[i];
            }
        }
        return null;
    }

    /**
     * @param {!number} messageId
     * @param {!Object} attachment
     * @return {undefined}
     */
    function open(messageId, attachment) {
        // The attachment is named to the tab, and read there. It used to be
        // read here and handed over as the url of a blob, but such a url
        // belongs to the page that made it, and this background is a page
        // that Thunderbird unloads as soon as it falls idle: the url died
        // with it, and the tab was left with nothing to read.
        messenger.tabs.create({
            url: messenger.runtime.getURL("viewer.html")
                + "?message=" + encodeURIComponent(messageId)
                + "&part=" + encodeURIComponent(attachment.partName)
                + "&name=" + encodeURIComponent(attachment.name)
        });
    }

    // The messages that are shown are read as a list, which is the only way
    // Thunderbird carries them since its version 121: the calls that named a
    // single message, "onMessageDisplayed" and "getDisplayedMessage", are
    // gone. The list holds the messages a reader selected together, and the
    // first of them is the one the header shows. Up to the version 120 the
    // list is an array, from the 121 on it is an object that holds one, as it
    // is read a page at a time.
    /**
     * @param {(!Array.<!Object>|!Object|null)} displayed
     * @return {?Object}
     */
    function firstMessage(displayed) {
        var messages;
        if (!displayed) {
            return null;
        }
        messages = displayed.messages || displayed;
        if (messages.length === undefined) {
            return messages;
        }
        return messages.length ? messages[0] : null;
    }

    /**
     * @param {!number} tabId
     * @return {!Promise}
     */
    function displayedMessage(tabId) {
        return messenger.messageDisplay.getDisplayedMessages(tabId).then(
            firstMessage
        );
    }

    /**
     * @return {!string}
     */
    function welcome() {
        // The page is written once for each language it is translated in,
        // "welcome.fr.html" beside "welcome.en.html", since a page of prose is
        // read and corrected far more easily as a page than as a file of
        // sentences apart. English is the one every other language falls on,
        // and it is named after its language as the others are.
        var language = messenger.i18n.getUILanguage().split("-")[0];
        if (LANGUAGES.indexOf(language) === -1) {
            language = "en";
        }
        return "welcome." + language + ".html";
    }

    // The page of the welcome is shown when the add-on is installed, and once
    // more when it is updated from a version that never showed it, which the
    // flag in the storage tells. The settings that name what opens a file are
    // read by no api at all, so the page tells how to set them rather than
    // reading them.
    messenger.runtime.onInstalled.addListener(function (details) {
        if (details.reason !== "install" && details.reason !== "update") {
            return;
        }
        messenger.storage.local.get("welcomed").then(function (stored) {
            if (details.reason === "update" && stored.welcomed) {
                return;
            }
            messenger.storage.local.set({welcomed: true});
            messenger.tabs.create({
                url: messenger.runtime.getURL(welcome())
                    + "?reason=" + details.reason
            });
        });
    });

    messenger.menus.create({
        id: ID,
        title: TITLE,
        contexts: ["message_attachments", "message_list", "page"]
    });

    /**
     * @param {!boolean} shown
     * @return {undefined}
     */
    function showEntry(shown) {
        messenger.menus.update(ID, {visible: shown});
        messenger.menus.refresh();
    }

    /**
     * Where a part of a message stands in it, as a list of numbers: the name
     * of a part is written "1.2", "1.10", and the two are read as numbers so
     * that the tenth part comes after the second one and not before it.
     * @param {!Object} attachment
     * @return {!Array.<!number>}
     */
    function partNumbers(attachment) {
        return String(attachment.partName || "").split(".").map(Number);
    }

    /**
     * @param {!Object} a
     * @param {!Object} b
     * @return {!number}
     */
    function byPart(a, b) {
        var left = partNumbers(a),
            right = partNumbers(b),
            i;
        for (i = 0; i < left.length && i < right.length; i += 1) {
            if (left[i] !== right[i]) {
                return left[i] - right[i];
            }
        }
        return left.length - right.length;
    }

    /**
     * The documents a message carries, in the order the message carries them.
     * The list the mail answers with follows no order of its own, so it is put
     * back in the order of the parts, which is the order the attachments are
     * shown in.
     * @param {!Array.<!Object>} attachments
     * @return {!Array.<!Object>}
     */
    function documents(attachments) {
        var i, found = [];
        for (i = 0; i < attachments.length; i += 1) {
            if (isDocument(attachments[i])) {
                found.push(attachments[i]);
            }
        }
        found.sort(byPart);
        return found;
    }

    /**
     * @return {undefined}
     */
    function clearChildren() {
        // A parent that keeps a child draws the arrow of a submenu, even where
        // the child is out of context and the submenu opens on nothing, so the
        // children of the menu before are taken away before anything else.
        children.forEach(function (id) {
            messenger.menus.remove(id);
        });
        children = [];
        documentsOfChildren = {};
    }

    /**
     * @param {!number} messageId
     * @param {!Array.<!Object>} found
     * @return {undefined}
     */
    function buildChildren(messageId, found) {
        // A message that carries one document is opened by the entry itself.
        // A message that carries several gets one child by document, named
        // after it, since only the reader knows which one is meant.
        clearChildren();
        if (found.length < 2) {
            return;
        }
        found.forEach(function (attachment, index) {
            var id = ID + "-" + index;
            messenger.menus.create({
                id: id,
                parentId: ID,
                title: attachment.name.replace(/&/g, "&&"),
                contexts: ["message_list", "page"]
            });
            children.push(id);
            documentsOfChildren[id] = {
                messageId: messageId,
                attachment: attachment
            };
        });
    }

    /**
     * @param {!Object} message
     * @return {undefined}
     */
    function showEntryOnDocument(message) {
        // The attachments have to be read before the entry is settled, and the
        // menu is refreshed once the answer is there, which is what refresh()
        // is for. It is hidden meanwhile, so that it never shows on a message
        // that carries no document.
        showEntry(false);
        messenger.messages.listAttachments(message.id).then(
            function (attachments) {
                var found = documents(attachments);
                buildChildren(message.id, found);
                if (found.length) {
                    showEntry(true);
                }
            }
        );
    }

    /**
     * @param {!Object} tab
     * @return {undefined}
     */
    function showEntryOnDisplayed(tab) {
        // The body of a message is read in a tab of the mail, in a window of
        // its own, and in the frames of the add-ons that lay the messages out
        // their own way, Conversations among them: all of them answer here,
        // and a tab that shows no message answers with nothing.
        displayedMessage(tab.id).then(function (message) {
            if (message) {
                showEntryOnDocument(message);
            }
        }, function () {
            return;
        });
    }

    // The entry is shown on the documents alone, so the other menus are left
    // as they are.
    messenger.menus.onShown.addListener(function (info, tab) {
        var message;
        if (info.attachments !== undefined) {
            // The reader points at one attachment, so there is nothing to
            // choose from and no submenu to draw.
            clearChildren();
            showEntry(Boolean(firstDocument(info.attachments)));
            return;
        }
        message = firstMessage(info.selectedMessages);
        if (message) {
            showEntryOnDocument(message);
            return;
        }
        showEntry(false);
        showEntryOnDisplayed(tab);
    });

    /**
     * @param {!Object} message
     * @return {undefined}
     */
    function openFirstDocument(message) {
        messenger.messages.listAttachments(message.id).then(
            function (attachments) {
                var found = firstDocument(attachments);
                if (found) {
                    open(message.id, found);
                }
            }
        );
    }

    messenger.menus.onClicked.addListener(function (info, tab) {
        var attachment, message, child = documentsOfChildren[info.menuItemId];
        if (child) {
            open(child.messageId, child.attachment);
            return;
        }
        if (info.menuItemId !== ID) {
            return;
        }
        // On the menu of an attachment, the document is the one that was
        // clicked, and the message is the one the tab shows: the data of the
        // click carries the attachment, not the message. On the menu of a
        // message, the message is there and the document is looked for.
        if (info.attachments !== undefined) {
            attachment = firstDocument(info.attachments);
            if (!attachment) {
                return;
            }
            displayedMessage(tab.id).then(function (shown) {
                if (shown) {
                    open(shown.id, attachment);
                }
            });
            return;
        }
        message = firstMessage(info.selectedMessages);
        if (!message) {
            // The menu of the body of a message carries no message at all, so
            // the one the tab shows is the one that is meant.
            displayedMessage(tab.id).then(function (shown) {
                if (shown) {
                    openFirstDocument(shown);
                }
            });
            return;
        }
        openFirstDocument(message);
    });

}());
