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
 * @source: https://webodf.org/
 * @source: https://github.com/webodf/WebODF/
 */

/*global chrome*/

/**
 * Send the documents in the OpenDocument format to the viewer of the extension,
 * instead of letting Chrome download them.
 *
 * Chrome dropped the blocking webRequest the add-on of Firefox redirects with,
 * so a rule of declarativeNetRequest does it. The rule is written here rather
 * than in a file of the manifest, as the url it redirects to has to be an
 * absolute one, and the identifier of the extension is only known once it is
 * installed.
 */
(function () {
    "use strict";

    var /**@const@type{!string}*/
        extensions = "odt|fodt|ott|odp|fodp|otp|ods|fods|ots|odg|fodg|otg|odf",
        /**@const@type{!number}*/
        ruleId = 1;

    function install() {
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId],
            addRules: [{
                id: ruleId,
                priority: 1,
                action: {
                    type: "redirect",
                    redirect: {
                        regexSubstitution: chrome.runtime.getURL("viewer.html")
                            + "?file=\\0"
                    }
                },
                condition: {
                    regexFilter: "^https?://[^?#]+\\.(" + extensions
                        + ")(\\?[^#]*)?$",
                    resourceTypes: ["main_frame", "sub_frame"]
                }
            }]
        });
    }

    chrome.runtime.onInstalled.addListener(install);
    chrome.runtime.onStartup.addListener(install);
}());
