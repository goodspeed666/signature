/* Copyright 2016 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals chrome */

'use strict';

let DEFAULT_URL = '';

window.epTools = {
  ready: function (callback) {
    if (callback && typeof callback == 'function') {
      this._readyCallback = callback;
    }
  }
};

if (typeof PDFJSDev !== 'undefined' && PDFJSDev.test('CHROME')) {
  (function rewriteUrlClosure() {
    // Run this code outside DOMContentLoaded to make sure that the URL
    // is rewritten as soon as possible.
    let queryString = document.location.search.slice(1);
    let m = /(^|&)file=([^&]*)/.exec(queryString);
    DEFAULT_URL = m ? decodeURIComponent(m[2]) : '';

    // Example: chrome-extension://.../http://example.com/file.pdf
    let humanReadableUrl = '/' + DEFAULT_URL + location.hash;
    history.replaceState(history.state, '', humanReadableUrl);
    if (top === window) {
      chrome.runtime.sendMessage('showPageAction');
    }
  })();
}

let pdfjsWebApp;
if (typeof PDFJSDev !== 'undefined' && PDFJSDev.test('PRODUCTION')) {
  pdfjsWebApp = require('./app.js');
}

if (typeof PDFJSDev !== 'undefined' && PDFJSDev.test('FIREFOX || MOZCENTRAL')) {
  require('./firefoxcom.js');
  require('./firefox_print_service.js');
}
if (typeof PDFJSDev !== 'undefined' && PDFJSDev.test('GENERIC')) {
  require('./genericcom.js');
}
if (typeof PDFJSDev !== 'undefined' && PDFJSDev.test('CHROME')) {
  require('./chromecom.js');
}
if (typeof PDFJSDev !== 'undefined' && PDFJSDev.test('CHROME || GENERIC')) {
  require('./pdf_print_service.js');
}

function getViewerConfiguration() {
  return {
    appContainer: document.body,
    mainContainer: document.getElementById('viewerContainer'),
    viewerContainer: document.getElementById('viewer'),
    eventBus: null, // using global event bus with DOM events
    toolbar: {
      container: document.getElementById('toolbarViewer'),
      numPages: document.getElementById('numPages'),
      pageNumber: document.getElementById('pageNumber'),
      scaleSelectContainer: document.getElementById('scaleSelectContainer'),
      scaleSelect: document.getElementById('scaleSelect'),
      scaleSelectPageActualOption: document.getElementById('pageActualOption'),
      scaleSelectPageFitOption: document.getElementById('pageFitOption'),
      scaleSelectPageWidthOption: document.getElementById('pageWidthOption'),
      customScaleOption: document.getElementById('customScaleOption'),
      previous: document.getElementById('previous'),
      next: document.getElementById('next'),
      zoomIn: document.getElementById('zoomIn'),
      zoomOut: document.getElementById('zoomOut'),
      openFile: document.getElementById('openFile'),
      closeFile: document.getElementById('closeFile'),
      print: document.getElementById('print'),
      presentationModeButton: document.getElementById('presentationMode'),
      download: document.getElementById('download'),
      about: document.getElementById('toolbar-about'),
      aboutContainer: document.getElementById('aboutContainer'),
    },
    secondaryToolbar: {
      toolbar: document.getElementById('secondaryToolbar'),
      firstPageButton: document.getElementById('firstPage'),
      lastPageButton: document.getElementById('lastPage'),
      pageRotateCwButton: document.getElementById('pageRotateCw'),
      pageRotateCcwButton: document.getElementById('pageRotateCcw'),
    },
    fullscreen: {
      contextFirstPage: document.getElementById('contextFirstPage'),
      contextLastPage: document.getElementById('contextLastPage'),
      contextPageRotateCw: document.getElementById('contextPageRotateCw'),
      contextPageRotateCcw: document.getElementById('contextPageRotateCcw'),
    },
    sidebar: {
      // Divs (and sidebar button)
      mainContainer: document.getElementById('mainContainer'),
      outerContainer: document.getElementById('outerContainer'),
      // Views
      thumbnailView: document.getElementById('thumbnailView'),
      outlineView: document.getElementById('outlineView'),
      annotationView: document.getElementById('annotationView'),
      attachmentsView: document.getElementById('attachmentsView'),
    },
    findBar: {
      bar: document.getElementById('findbar'),
      findField: document.getElementById('findInput'),
      highlightAllCheckbox: document.getElementById('findHighlightAll'),
      caseSensitiveCheckbox: document.getElementById('findMatchCase'),
      findMsg: document.getElementById('findMsg'),
      findResultsCount: document.getElementById('findResultsCount'),
      findStatusIcon: document.getElementById('findStatusIcon'),
      findPreviousButton: document.getElementById('findPrevious'),
      findNextButton: document.getElementById('findNext'),
    },
    passwordOverlay: {
      overlayName: 'passwordOverlay',
      container: document.getElementById('passwordOverlay'),
      label: document.getElementById('passwordText'),
      input: document.getElementById('password'),
      submitButton: document.getElementById('passwordSubmit'),
      cancelButton: document.getElementById('passwordCancel'),
    },
    documentProperties: {
      overlayName: 'documentPropertiesOverlay',
      container: document.getElementById('documentPropertiesOverlay'),
      closeButton: document.getElementById('documentPropertiesClose'),
      fields: {
        'fileName': document.getElementById('fileNameField'),
        'fileSize': document.getElementById('fileSizeField'),
        'title': document.getElementById('titleField'),
        'author': document.getElementById('authorField'),
        'subject': document.getElementById('subjectField'),
        'keywords': document.getElementById('keywordsField'),
        'creationDate': document.getElementById('creationDateField'),
        'modificationDate': document.getElementById('modificationDateField'),
        'creator': document.getElementById('creatorField'),
        'producer': document.getElementById('producerField'),
        'version': document.getElementById('versionField'),
        'pageCount': document.getElementById('pageCountField'),
      },
    },
    errorWrapper: {
      container: document.getElementById('errorWrapper'),
      errorMessage: document.getElementById('errorMessage'),
      closeButton: document.getElementById('errorClose'),
      errorMoreInfo: document.getElementById('errorMoreInfo'),
      moreInfoButton: document.getElementById('errorShowMore'),
      lessInfoButton: document.getElementById('errorShowLess'),
    },
    printContainer: document.getElementById('printContainer'),
    openFileInputName: 'fileInput',
    debuggerScriptPath: './debugger.js',
    defaultUrl: DEFAULT_URL,
  };
}

function webViewerLoad() {
  let config = getViewerConfiguration();

  String.prototype.replaceAll = function (replaceStr, newStr) {
    var str = this;

    if (str.indexOf(replaceStr) !== -1) {
      str = this.replace(replaceStr, newStr);
      return str.replaceAll(replaceStr, newStr);
    } else {
      return str;
    }
  };

  if (typeof PDFJSDev === 'undefined' || !PDFJSDev.test('PRODUCTION')) {
    Promise.all([
      SystemJS.import('pdfjs-web/app'),
      SystemJS.import('pdfjs-web/genericcom'),
      SystemJS.import('pdfjs-web/pdf_print_service'),
    ]).then(function ([app, ...otherModules]) {
      window.PDFViewerApplication = app.PDFViewerApplication;
      app.PDFViewerApplication.run(config);
      createApi(config);
    });
  } else {
    window.PDFViewerApplication = pdfjsWebApp.PDFViewerApplication;
    pdfjsWebApp.PDFViewerApplication.run(config);
    createApi(config);
  }
}

function createApi(config) {
  let defaultSettings = {
    ShowToolBarButton: function (nIndex, bShow) {
      nIndex = parseInt(nIndex, 10);
      bShow = typeof bShow == 'boolean' ? bShow : true;

      var moduleEl = document.querySelector('[tabindex="' + nIndex + '"]');

      if (moduleEl) {
        bShow ? moduleEl.classList.remove('hidden') : moduleEl.classList.add(
          'hidden');
      } else {
        alert('无此编号按钮');
      }
    },
    GoToPage: function (pageNumber) {
      PDFViewerApplication.pdfViewer.currentPageLabel = pageNumber;
    },
    GetCurrentPageIndex: function () {
      return PDFViewerApplication.page;
    },
    GetPageCount: function () {
      return PDFViewerApplication.pagesCount;
    },
    OpenFile: function (path) {
      PDFViewerApplication.localUrl = '';
      PDFViewerApplication.open(path);
    },
    GotoBookMarkByBookMarkName: function (text) {
      var outline = PDFViewerApplication.pdfOutlineViewer.outline;

      if (outline && Array.isArray(outline)) {

        for (let i = 0, len = outline.length; i < len; i++) {
          const item = outline[i],
            title = item.title,
            items = item.items;

          if (~title.indexOf(text)) {
            PDFViewerApplication.pdfOutlineViewer.linkService.navigateTo(
              item.dest);

            return;
          } else if (items && Array.isArray(items)) {
            let k = 0;

            while (k < items.length) {
              const _item = items[k];

              if (~_item.title.indexOf(text)) {
                PDFViewerApplication.pdfOutlineViewer.linkService.navigateTo(
                  _item.dest);

                return;
              }

              k++;
            }
          }
        }
      } else {
        alert('无书签页');
      }
    },
    GetFilePath: function () {
      return PDFViewerApplication.localUrl || PDFViewerApplication.url;
    },
    CloseFile: function () {
      PDFViewerApplication.close();
    },
    AfterSignPDF: function () {},
    AfterDelSignature: function () {},
    /**
     * 设置暗标
     * @param {Object} str 当前字符串
     * @param {Object} darkMarkStr 暗标字符
     */
    SetDarkMark: function (str, darkMarkStr) {
      this._darkMarkOptions = {
        str: str,
        darkMarkStr: darkMarkStr || '*'
      };
    },
    /**
     * 设置 userId
     * @param {String} userId 接口需要的 userId
     */
    setUserId: function (userId) {
      this.userId = userId ? userId : this.getLocationUserId();
    },
    /**
     * 获取 userId
     * @returns {String} userId 
     */
    getUserId: function () {
      return this.userId ? this.userId : this.getLocationUserId();
    },
    getLocationUserId: function () {
      var result = window.location.search.match(/user=([^&]*)/);

      if (result && Array.isArray(result)) {
        return result[1];
      }

      return '';
    },
    /**
     * 是否显示签章按钮
     * @param {Boolean} isShow 是否显示签章菜单
     */
    isShowSignMenu: function (isShow) {
      var signContainerEl = document.getElementById('signContainer');

      isShow ? signContainerEl.classList.remove('hidden') : signContainerEl
        .classList.add('hidden');
    },
    /**
     * 打印功能
     */
    print: function () {
      window.print();
    },
    /**
     * 获取签章总个数
     * @returns {Number} 签章个数
     */
    getSignCount: function () {
      return window.signCount || 0;
    },

    /**
     * @private
     * 判断当前环境是否是在 file 协议中
     */
    _isFileProtocol: function() {
      return window.location.href.indexOf('file:///') !== -1 ? true : false;
    },

    /**
     * @private
     * arraybuffer 转 base64
     * @param {arraybuffer} buffer
     */
    _arrayBufferToBase64: function(buffer) {
      let binary = '',
        bytes = new Uint8Array( buffer ),
        len = bytes.byteLength;

      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[i] );
      }

      return window.btoa( binary );
    },

    /**
     * 获取搜索过的关键字
     * @param {Function} callback 回掉函数
     */
    getStorageSrhVal: function(callback) {
      let storageSearchValue = localStorage.getItem('___epPdfStorageSrhVal');

      console.log(storageSearchValue);
      callback && typeof callback === 'function' && callback.call(this, storageSearchValue ? JSON.parse( storageSearchValue ) : null);
    },

    /**
     * 设置搜索关键字
     * @param {String} keyword 关键字
     */
    _setStorageSrhVal: function(keyword) {
      this.getStorageSrhVal(function(value) {
        if (value && Array.isArray(value)) {
          if (value.indexOf(keyword) == -1) {
            value.push(keyword);
            localStorage.setItem('___epPdfStorageSrhVal', JSON.stringify(value));
          }
        }
        else {
          value = [keyword];
          localStorage.setItem('___epPdfStorageSrhVal', JSON.stringify(value));
        }
      });
    },

    keyWordSignElArray: []
  };

  extend(window.epTools, defaultSettings);

  let _readyCallback = window.epTools._readyCallback;

  if (_readyCallback && typeof _readyCallback == 'function') {
    _readyCallback.call(window.epTools);
  }
}

function extend() {
  var args = [].slice.call(arguments),
    result = args[0];

  for (var i = 1, len = args.length; i < len; i++) {
    var item = args[i];

    for (var k in item) {
      if (result[k] === undefined) {
        result[k] = item[k];
      }
    }
  }

  return result;
}

if (document.readyState === 'interactive' ||
  document.readyState === 'complete') {
  webViewerLoad();
} else {
  document.addEventListener('DOMContentLoaded', webViewerLoad, true);
}
