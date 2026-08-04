# The public API of WebODF

This says what a program may lean on: the objects the library offers, what
they answer and what they promise. Everything else in `webodf/lib` is the
inside of the library and may change without warning.

The library is one file, `webodf.js`, built as
[README-Building.md](README-Building.md) says. It writes two namespaces of its
own, `odf` and `gui`, and nothing else in the page.

```html
<script src="webodf.js"></script>
<div id="odf"></div>
<script>
    var canvas = new odf.OdfCanvas(document.getElementById("odf"));
    canvas.setPaginated(true);
    canvas.load("document.odt");
</script>
```

## What the library runs in

The library reads the elements of a document by their namespace, writes the
rules of the pages in a sheet of the document, lays the pages in boxes that
keep the spacings of an office apart, and asks the engine for the fonts a
document names before it breaks it into pages. An engine that has all of that
draws a document; one that has not draws nothing.

| engine       | floor |
|--------------|-------|
| Chrome       | 88    |
| Firefox      | 78    |
| Safari       | 15.4  |
| Qt WebEngine | 6.4   |

Internet Explorer draws nothing of a document, whatever its version: it has no
DOM that reads a namespace. The sources are written in the third edition of
the language, and the compiler is told so, but that says how the file is
parsed and not what it needs to run.

The same document is not broken into the same number of pages by two engines:
the lines are not of the same height, and eight hundred pages of one are eight
hundred and sixty of another. A program that counts on a number of pages
counts on the engine as well.

## odf.OdfCanvas

A canvas draws one document in one element of a page. It is made with the
element to draw in, and the element is emptied of whatever it held.

### Reading a document

| call                                        | what it does                                                                                   |
|---------------------------------------------|------------------------------------------------------------------------------------------------|
| `load(url)`                                 | Read the document at that address and draw it. A canvas that held another document forgets it. |
| `odfContainer()`                            | The `odf.OdfContainer` of the document that is drawn, or nothing before one is read.           |
| `setOdfContainer(container, suppressEvent)` | Draw a document that was read another way.                                                     |
| `save(callback)`                            | Write the document back, as it stands, and answer the bytes to the callback.                   |
| `destroy(callback)`                         | Take the document out of the page and let go of what it held.                                  |

### Being told what happens

`addListener(name, handler)` asks to be told of one of these:

| name               | when                                           | what the handler is given |
|--------------------|------------------------------------------------|---------------------------|
| `statereadychange` | the document is read, or could not be          | the `odf.OdfContainer`    |
| `pagesdrawn`       | every page of a text has been broken and drawn | nothing                   |
| `click`            | the reader clicks in the document              | the event                 |

A document that cannot be read is answered all the same: the container says
`odf.OdfContainer.INVALID` rather than `DONE`.

```js
canvas.addListener("statereadychange", function (container) {
    if (container.state === odf.OdfContainer.INVALID) {
        return;
    }
    canvas.fitSmart(window.innerWidth);
});
```

### Drawing a text over pages

A text is drawn as one run of text until it is asked otherwise. What follows
is of a text; a presentation and a drawing are drawn slide by slide whatever
is asked here.

| call                          | what it does                                                                                                                                                                                                |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `setPaginated(on)`            | Break the text into pages, or draw it as one run again.                                                                                                                                                     |
| `isPaginated()`               | Whether it is broken into pages.                                                                                                                                                                            |
| `setPageMode(mode)`           | `"pages"` lays the pages one under another, each page a box of its own; `"columns"` lays them beside one another, each page a column; `"flow"` writes the text as one run, as a page of the web is written. |
| `setPagesPerRow(n)`           | How many pages stand side by side on a row: one to scroll a document, two to read a book.                                                                                                                   |
| `setFirstPageOnItsOwn(alone)` | Whether the first page stands alone on the right of its row, as the first page of a book does.                                                                                                              |
| `refreshNumbering()`          | Write the labels of the lists and of the headings again, after an editor has changed one.                                                                                                                   |
| `pageBoxAt(x)`                | Where the page that holds that place begins and ends across, or nothing when the text is drawn as one run.                                                                                                  |

Breaking a document of many pages takes time: it is done a few pages at a
time, so a reader sees the first of them at once, and `pagesdrawn` says when
the last of them is drawn.

### The size the document is drawn at

| call                                                  | what it does                                                                                                                                                  |
|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `setZoomLevel(zoom)`, `getZoomLevel()`                | The size the document is drawn at, one being the size it was written at.                                                                                      |
| `fitToWidth(width)`                                   | Scale the document to that width, up or down.                                                                                                                 |
| `fitSmart(width, height)`                             | Scale it down to that width, and to that height where one is given, but never up: a document is read at the size it was written at where the window holds it. |
| `fitToHeight(height)`, `fitToContainingElement(w, h)` | The same, of a height, or of the element the canvas draws in.                                                                                                 |
| `getSizer()`                                          | The element the document is drawn in, which is what the zoom is set on.                                                                                       |
| `getElement()`                                        | The element the canvas was made with.                                                                                                                         |
| `refreshSize()`                                       | Read the size of the window again, after it has changed.                                                                                                      |

### Slides

`showFirstPage()`, `showNextPage()`, `showPreviousPage()` and `showPage(n)`
move through the slides of a presentation.

### Annotations

`enableAnnotations(on, showRemoveButton)` draws the annotations of a document
in a lane beside the text. `addAnnotation`, `forgetAnnotation`,
`refreshAnnotations` and `getAnnotationViewManager` are for an editor that
writes them.

## odf.OdfContainer

The document itself: the parts of the package and the tree of the document.

| call                                                   | what it does                                                                                                                                                                                                                 |
|--------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `new odf.OdfContainer(url, onchange)`                  | Read a document from an address; the callback is told at every turn of its state.                                                                                                                                            |
| `state`                                                | `odf.OdfContainer.LOADING`, `DONE` or `INVALID`.                                                                                                                                                                             |
| `rootElement`                                          | The document, whose `body`, `styles`, `automaticStyles`, `masterStyles`, `meta` and `settings` are the parts of it. A document that holds none of one of these is given an empty one, so a reader never has nothing to read. |
| `getDocumentType()`                                    | `"text"`, `"presentation"`, `"spreadsheet"` or `"drawing"`.                                                                                                                                                                  |
| `getContentElement()`                                  | The element of the body that holds what is written.                                                                                                                                                                          |
| `getPart(path)`, `getPartData(path, callback)`         | A part of the package: an image, a formula, a chart.                                                                                                                                                                         |
| `setBlob(path, mimetype, content)`, `removeBlob(path)` | Put a part in the package or take it out.                                                                                                                                                                                    |
| `save(callback)`, `getUrl()`                           | Write the package back, and the address it was read from.                                                                                                                                                                    |
| `isTemplate()`, `setIsTemplate(on)`                    | Whether the document is a template, `.ott` rather than `.odt`.                                                                                                                                                               |

## The viewer of the desktop

The window of the viewer speaks to the page it draws in through
`window.viewer`, see `programs/opendocumentviewer-desktop/assets/viewer.js`:

| call                               | what it does                                                           |
|------------------------------------|------------------------------------------------------------------------|
| `load()`                           | Draw the document the window serves.                                   |
| `unload()`                         | Put the document away and show what the window shows with none.        |
| `zoomBy(factor)`, `setZoom(level)` | Zoom in and out.                                                       |
| `fit()`                            | Draw the page as wide as the window allows.                            |
| `setPages(perRow, firstAlone)`     | One page to a row, two, or two with the first on the right of its own. |

## What is not the public API

The objects under `ops`, `gui` and `webodfcore` are those of the editor and of
the inside of the library. They are written for the editors that live in this
repository and they change with them. A program that leans on them leans on
something that may be written otherwise tomorrow.
