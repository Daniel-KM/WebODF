## WebODF

WebODF is a ODF JavaScript library originally created by KO GmbH.

It makes it easy to add Open Document Format (ODF) support to your website and
to your mobile or desktop application. It uses HTML and CSS to display ODF
documents.

* Visit the project homepage at: [WebODF](https://webodf.org)
* Want some live demos? Visit: [WebODF Demos](https://webodf.org/demos/)
* Get in contact:
  * the issues of the repository, that are read
  * Slack: webodf.slack.com, use the [self-invite](https://join.slack.com/t/webodf/shared_invite/enQtNTQ1NDAyNDU1NjY2LWFlZDg1NzBjY2IzY2RmMzhhMTcwZjM1YjJjOTRmMjM4Yzg1MzhjODY5N2MwOWQwMWNiNzhlZTVlYjI3MDY5YTc)
  * the [mailing list](https://lists.nlnet.nl/archives/list/webodf@nlnet.nl/),
    that NLnet hosts

The channel of freenode was the other way, and it answers no more: freenode was
abandoned in 2021.

### License

WebODF is a Free Software project. All code is available under the AGPL.

If you are interested in using WebODF in your commercial product
(and do not want to disclose your sources / obey AGPL),
get in touch at [the license page](https://webodf.org/about/license.html) for a
license suited to your needs.


### Creating webodf.js...

webodf.js is compiled by using the Closure Compiler. This compiler concatenates
and compacts all JavaScript files, so that they are smaller and execute faster.
CMake is used to setup the buildsystem, so webodf.js can be created:

```sh
git clone https://github.com/webodf/WebODF.git webodf
mkdir build
cd build
cmake -S ../webodf
make webodf.js-target
```

A successful run will yield the file "webodf.js" in the subfolder "build/webodf/",
among other things, from where you can then copy it and use for your website.

For more details about preparing the build of webodf.js , e.g. on Windows or OSX,
please study ["README-Building.md"](README-Building.md).

What a program may lean on in the library — the canvas that draws a document,
the container that holds it, and what each of them answers — is written in
["PUBLIC-API.md"](PUBLIC-API.md).

### ... and more

This repository not only contains code for the library webodf.js, but also a few
products based on it. Here is the complete list:

build target                           | output location (in build/)                         | description                                  |
---------------------------------------|-----------------------------------------------------|----------------------------------------------|
webodf.js-target                       | webodf/webodf.js                                    | the library as standalone for any js project |
product-library                        | node-webodf-x.y.z.tgz                               | the library and the classes it is made of    |
product-opendocumenttexteditor         | opendocumenttexteditor-x.y.z.zip                    | simple to use editor component               |
product-opendocumenttextcollab         | opendocumenttextcollab-x.y.z.zip                    | collaborative editor component               |
product-opendocumentviewer-webext      | opendocumentviewer-firefox-x.y.z.xpi                | ODF viewer add-on for Firefox and Chrome     |
product-opendocumentviewer-thunderbird | opendocumentviewer-thunderbird-x.y.z.xpi            | ODF viewer add-on for Thunderbird            |
product-opendocumentviewer-desktop     | opendocumentviewer-x.y.z-*.tar.gz, .deb, .rpm, .zip | ODF viewer for linux, windows and macos      |
product-opendocumentviewer-android     | opendocumentviewer-x.y.z.apk                        | ODF viewer application for Android           |

("x.y.z" is a placeholder for the actual version number)

A tag that names a version publishes these products with the release, on both
forges and apart:

* [the releases of github](https://github.com/webodf/WebODF/releases)
* [the releases of gitlab](https://gitlab.com/Sempia/WebODF/-/releases)

Github builds the viewers of windows and of macos, which its runners of those
systems alone can build; gitlab, whose runners are of linux, builds what a linux
builds. What asks for a key of its own is published by neither: the apk of
android, the bundle of macos and the application of ios. Which product lands
where is named in ["README-Products.md"](README-Products.md), which tells more
of the products as well.
