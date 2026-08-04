/**
 * Copyright (C) 2026 Daniel Berthereau <Daniel.git@Berthereau.net>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

import UIKit

/// The whole of the application: one window, one view, and the document the
/// system hands over.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private let viewer = ViewerController()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions
            options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = viewer
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    /// A document is opened from a mail, from the files of the system or from
    /// another application: it is drawn at once, whether the viewer was
    /// already running or is starting for it.
    func application(_ application: UIApplication, open document: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:])
            -> Bool {
        viewer.show(document: document)
        return true
    }
}
