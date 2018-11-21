(function (win, fn) {
  'use strict';

  let returnVal = fn();

  for (let k in returnVal) {
    win[k] = returnVal[k];
  }

}(window, function () {
  const $uiPopup = $('#ui-popup'),
    $uiPopupContent = $('#ui-popup-content'),
    $viewerContainer = $('#viewerContainer'),
    $signContainer = $('#signContainer'),
    $signaturePreview = $('#signature-preview'),
    $sign = $('#sign'),
    $mainContainer = $('#mainContainer'),
    $contextmenu = $('#delsigndiv'),
    $selectSignType = $('#selectSignType'),
    $choicePage = $('#choicePage'),
    $verifyContainerCon = $('#verifyContainer .verifyContainer-con');

  let isOpenSig = false, // 是否满足签章条件，并且点击了开始签章
    signElArray = [],
    initSignImgWidth = 0,
    initSignImgHeight = 0,
    signSearchVal = '', // 关键字签章的时候的签章关键字
    siderMenuBarWidth = $('#siderMenuBar').width(),
    selectSignType = 'normal', // 添加签章 ——> 签章类型，默认为 普通签章(normal)
    signInformation = [], // 签章完毕后，保存的签章信息，key 是对应的 signId
    keyWordSignNotLoadedData = []; // 关键字签章的时候，当前关键字所在页面未签页面的合集数据

  let sign_div,
    sign_img;

  let blob_Url = null,
    time = null; // 轮训接口的定时器

  const SidebarView = {
    NONE: 0,
    THUMBS: 1,
    OUTLINE: 2,
    ATTACHMENTS: 3,
    ANNOTATION: 4
  };

  const toolbarHeight = $('#toolbarContainer').height();
  const qrcode = new QRCode('qrcode', {
    width: 300,
    height: 300
  });

  function init() {
    initListener();
    toolbarBindListeners();
  }

  function initListener() {
    let offsetLeft,
      offsetTop;

    $viewerContainer.on('click', 'section[data-annotation-type=sign]',
      function () {
        let id = $(this).attr('data-annotation-id'),
          signData = window.responseSignData || [];

        if (signData.length < 1) {
          alert('暂无此签章信息');
          return;
        }

        $.each(signData, function (i, e) {
          if (e.id == id) {
            // 渲染签章信息
            renderSignInformation(e);
          }
        });
      }).on('click', '.page', function () {
      let pageNumber = $(this).attr('data-page-number');

      // 如果开启了签章，并且已有pdf展示
      if (isOpenSig) {
        let left = parseInt($(sign_div).css('left'), 10),
          top = parseInt($(sign_div).css('top'), 10);

        let div = document.createElement('div'),
          img = document.createElement('img'),
          scale = PDFViewerApplication.toolbar.pageScale;

        div.className = '_addSign';
        img.src = sign_img.src;
        img.className = '_signimg';
        img.width = sign_img.width;
        img.height = sign_img.height;

        $(div).css({
          left: left,
          top: top
        });
        div.appendChild(img);

        let imgBase64 = imgToBase64(img) || '';

        if (imgBase64.indexOf('base64') !== -1) {
          imgBase64 = imgBase64.split(',')[1];
        }

        img.onload = function () {
          const x = (left + img.width / 2) / scale * 0.75,
            y = (top + img.height / 2) / scale * 0.75;

          const userId = epTools.getUserId();

          // TODO: 根据类型走不同的函数处理
          switch (selectSignType) {
            case 'normal':
              // 验证二维码, 一定要扫码后方可进行签章
              createSignQrCode({
                "userid": userId,
                "sign": {
                  "signimg": imgBase64,
                  "positions": [{
                    "page": pageNumber,
                    "x": x,
                    "y": y
                  }]
                }
              }, comSignUrl, function (response) {
                createSignCallback(response, top, left);
              });
              break;

            case 'multiSign':
              const selectMultiPageSignType = $(
                '#choicePage input[type=radio]:checked').prop(
                'value');
              let params = {};
              // 签章的页面数, pageNumber
              let pages = [];

              // 全部页面签章
              if (selectMultiPageSignType == 'all') {
                let pagesCount = epTools.GetPageCount();

                for (let i = 1; i <= pagesCount; i++) {
                  pages.push(i);
                }
              }
              // 指定页面签章
              else if (selectMultiPageSignType == 'multiplePages') {
                const spreadPageVal = $('#spreadPage').val();

                if (!spreadPageVal) {
                  alert('请输入要进行签章的页码数');
                  return;
                }

                if (spreadPageVal && typeof spreadPageVal == 'string') {
                  let spreadPageArray = spreadPageVal.split('、');

                  $.each(spreadPageArray, function (i, e) {
                    e = parseInt(e, 10);
                    // 如果是当前页面
                    pages.push(e);
                  });
                }
              }

              params = {
                "userid": userId,
                "sign": {
                  "signimg": imgBase64,
                  "position": {
                    "pages": pages,
                    "x": x,
                    "y": y
                  }
                }
              };

              // 创建签章二维码，multiSignPage
              createSignQrCode(params, multiPageSignUrl, function (
                response) {
                createSignCallback(response, top, left);
              });
              break;

            default:
              break;
          }

          let movesign = $(this).find('.movesign');

          $.each(movesign, function (i, e) {
            e.remove();
          });

          sign_div = null;
          sign_img = null;
          isOpenSig = false;
        };
      }
    }).on('mouseenter', '.page', function (e) {
      const $this = $(this);
      let pageX = e.pageX,
        pageY = e.pageY;

      offsetLeft = this.offsetLeft + $mainContainer.get(0).offsetLeft;
      offsetTop = this.offsetTop + $mainContainer.get(0).offsetTop;

      if (isOpenSig) {
        let top = pageY - offsetTop - sign_img.height / 2 +
          $viewerContainer.get(0).scrollTop - toolbarHeight,
          left = pageX - offsetLeft - sign_img.width / 2 -
          siderMenuBarWidth;

        $(sign_div).css({
          top: top + 'px',
          left: left + 'px'
        });

        $this.append(sign_div);
      }
    }).on('mousemove', '.page', function (e) {
      let pageX = e.pageX,
        pageY = e.pageY;

      offsetLeft = this.offsetLeft + $mainContainer.get(0).offsetLeft;
      offsetTop = this.offsetTop + $mainContainer.get(0).offsetTop;

      if (isOpenSig) {
        let top = pageY - offsetTop - sign_img.height / 2 +
          $viewerContainer.get(0).scrollTop - toolbarHeight,
          left = pageX - offsetLeft - sign_img.width / 2 -
          siderMenuBarWidth;

        $(sign_div).css({
          top: top + 'px',
          left: left + 'px'
        });
      }
    }).on('mouseleave', function (e) {
      let movesign = $(this).find('.movesign');

      $.each(movesign, function (i, e) {
        e.remove();
      });

      sign_div = null;
      sign_img = null;
      isOpenSig = false;
    });

    // 点击查找按钮
    $('#findBtn').on('click', function () {
      PDFViewerApplication && PDFViewerApplication.findBar.dispatchEvent(
        '');
    });

    // 关闭签章区域
    let closeSignPad = function () {
      $signContainer.addClass('hidden');
    };

    $selectSignType.on('click', 'input[type=radio]', function () {
      const val = this.value;

      selectSignType = val;

      // 如果选择的是批量签章展示页数
      if (selectSignType == 'multiSign') {
        $choicePage.removeClass('hidden');
      } else {
        $choicePage.addClass('hidden');
      }
    });

    // 点击添加签章按钮签章
    $('#signContainer').on('click', '.confirm-btn', function () {
        if (PDFViewerApplication.pdfViewer.viewer.childNodes.length == 0) {
          isOpenSig = false;

          alert('请先打开需要签章的pdf文件');
          closeSignPad();
        } else {
          // 如果选择的签章类型是关键字签章，则不生成signElement
          if (selectSignType == 'keyWordSign') {
            let epTools = window.epTools;

            signSearchVal = $('.sigsearch-input').val();
            epTools && typeof epTools.keyWordStamp == 'function' &&
              epTools.keyWordStamp(signSearchVal);
          }
          // 如果选择的签章类型是骑缝签章，则不生成 signElement
          else if (selectSignType == 'pagingSeal') {
            handlePagingSeal();
          }
          else {
            // 创建 sign_div
            createSignElement();
          }
          // 关闭签章面板
          closeSignPad();
        }
      })
      .on('click', '.signContainer-close', function () {
        // 点击关闭 X
        closeSignPad();
      });

    // 单个签章
    $sign.on('click', function () {
      //    $signaturePreview.html("<img src='./images/company.png' />");
      $signContainer.removeClass('hidden');
    });

    $uiPopup.on('click', '.ui-popup-close', function () {
      $uiPopup.removeClass('zoomIn animated faster');
      $uiPopup.addClass('hidden');
    }).on('click', '.ep-a-cert', function (e) {
      e.preventDefault();

      // 点击下载证书
      if (blob_Url) {

        if ('msSaveOrOpenBlob' in window.navigator) {
          // Microsoft Edge and Microsoft Internet Explorer 10-11
          window.navigator.msSaveOrOpenBlob(blob_Url, '证书.cer');
        } else {
          // chrome or firefox
          let a = document.createElement('a');

          a.download = '证书';
          a.href = window.URL.createObjectURL(blob_Url);
          a.click();
        }
      }
    });

    $contextmenu.on('click', 'li', function () {
      let $el = $viewerContainer.find('[data-index="' + delSerial +
          '"]'),
        signId = $el.attr('data-signid');

      signElArray.splice(delSerial, 1, undefined);

      if (signId) {
        // 删除对应的签章信息
        $.each(signInformation, function (i, e) {
          if (e && e[signId]) {
            signInformation.splice(i, 1, undefined);
            signInformation = signInformation.filter(function (e, i) {
              if (Boolean(e)) {
                return e;
              }
            });
          }
        });
      }

      $(PDFViewerApplication.appConfig.sidebar.annotationView).find(
        '[data-id="' + signId + '"]').remove();
      $el.remove();
      $contextmenu.hide();
    });

    $('img').on('mousedown', function (e) {
      e.preventDefault();
    });

    // 点击左侧 sideBar menu
    $('#siderMenuBar').on('click', '.menuItem', function () {
      let menuType = this.dataset.menu,
        $this = $(this);

      if (!$this.hasClass('silderOpen')) {
        $this.toggleClass('active').siblings('.menuItem').removeClass(
          'active');
      }

      switch (menuType) {
        case 'bookMark':
          PDFViewerApplication.pdfSidebar.switchView(SidebarView.OUTLINE);
          break;

        case 'thumbnail':
          PDFViewerApplication.pdfSidebar.switchView(SidebarView.THUMBS);
          break;

        case 'annotation':
          PDFViewerApplication.pdfSidebar.switchView(SidebarView.ANNOTATION);
          break;

        default:
          break;
      }
    });

    // 关闭 silderBar
    $('#silderClose').on('click', function () {
      $('#siderMenuBar .menuItem').removeClass('active');
      PDFViewerApplication.pdfSidebar.close();
    });

    // 点击显示签章信息
    $viewerContainer.on('click', '._addSign', function () {
      let signid = this.dataset.signid,
        value = null;

      $.each(signInformation, function (i, e) {
        let item = e[signid];

        if (item) {
          value = item;
          return;
        }
      });

      if (!value) {
        alert('暂无此签章信息');
        return;
      }

      // 渲染签章信息
      renderSignInformation(value);
    });

    $('#mask').on('click', function () {
      clearTimeout(time);
      $(this).addClass('hidden');
      $('#qrcodeContainer').addClass('hidden');
    });
  }

  /**
   * 处理骑缝签章
   */
  function handlePagingSeal() {
    // 当前页面中 pages 元素的个数
    const _pagesLen = PDFViewerApplication.pdfViewer._pages.length,
      imgEl = document.createElement('img');

    if (!_pagesLen > 0) {
      return;
    }

    const $page = $viewerContainer.find('.page[data-page-number=1]');

    imgEl.src = $signaturePreview.find('img').prop('src');
    imgEl.className = '_signimg';
    imgEl.onload = function() {
      const imgWidth = this.width,
        imgHeight = this.height,
        left = $page.width() - imgWidth / 2,
        top = $page.height() / 2 - imgHeight / 2,
        that = this;

      let ratio = 0; // 骑缝签章等分比

      if (_pagesLen <= 10) {
        ratio = imgWidth / _pagesLen;
      }

      for (let i = 1; i <= _pagesLen; i++) {
        var $curPage = $viewerContainer.find('.page[data-page-number=' + i + ']'),
          curPage = $curPage.get(0),
          signEl = document.createElement('div'),
          signImgEl = document.createElement('img');

        $(signEl).css({
          left: left,
          top: top,
          clip: 'rect(0px, '+ ratio +'px, '+ imgHeight +'px, 0px)'
        });

        $(signImgEl).css({
          width: imgWidth,
          height: imgHeight
        });

        signEl.className = '_addSign';
        signImgEl.src = that.src;
        signImgEl.className = '_signimg';
        signEl.appendChild(signImgEl);

        if (curPage && curPage.nodeType == 1) {
          signEl.appendChild(imgEl);
          curPage.appendChild(signEl);
        }
      }
    };
  }

  /**
   * @param  {[Object]} response 返回参数
   * @param  {[Number]} top 签章距离顶部的距离
   * @param  {[Number]} left 签章距离左侧的距离
   */
  function createSignCallback(response, top, left) {
    let verify = response.msg.verify,
      imgEl = document.createElement('img'),
      imgSrc = 'data:image/png;base64,' + verify[0].signImg;

    epTools.downloadUrl = response.msg.url;
    imgEl.src = imgSrc;

    // 图片加载完毕后
    imgEl.onload = function () {
      let imgWidth = this.width,
        imgHeight = this.height;

      for (let i = 0, len = verify.length; i < len; i++) {
        let signEl = document.createElement('div'),
          signImgEl = document.createElement('img'),
          item = verify[i],
          signid = item.signid,
          pageNumber = item.page,
          tmp = {},
          isIntegrity = item.isIntegrity;

        tmp[signid] = item;
        signInformation.push(tmp);
        signEl.className = '_addSign';
        signEl.dataset.signid = signid;
        signImgEl.src = imgSrc;
        signImgEl.className = '_signimg';

        $(signEl).css({
          left: left,
          top: top
        });

        $(signImgEl).css({
          width: imgWidth,
          height: imgHeight
        });

        signEl.appendChild(signImgEl);
        window.signCount += 1;

        let $curPage = $viewerContainer.find(
            '.page[data-page-number=' + pageNumber + ']'),
          curPageEl = $curPage.get(0);

        if (curPageEl && curPageEl.nodeType == 1) {
          curPageEl.appendChild(signEl);

          if (!!isIntegrity) {
            // TODO: 创建签章状态标识 isIntegrity 为 true
            createSignStatusImg('success', signid, epTools.AfterSignPDF);
          } else {
            // 创建签章状态标识 isIntegrity 为 false
            window.isSignIntegrity = false;
            createSignStatusImg('error', signid, epTools.AfterSignPDF);
          }
        }

        // 添加到数字签名区域
        addToAnnotationView(item);
        signElArray.push({
          pageNumber: pageNumber,
          signid: signid,
          signEl: signEl,
          isIntegrity: isIntegrity,
          scale: PDFViewerApplication.toolbar.pageScale,
          imgWidth: imgWidth,
          imgHeight: imgHeight,
          top: top,
          left: left,
          pageRotation: PDFViewerApplication.pageRotation
        });
      }
    };
  }

  $.extend(window.epTools, {
    /**
     * 关键字盖章
     * @param {Object} keyword 要盖章的关键字
     */
    keyWordStamp: function (keyword) {
      if (!keyword) {
        alert('请输入要盖章的关键字');
        return;
      }

      let $img = $('#signature-preview img');
      let params = {
        "userid": epTools.getUserId(),
        "sign": {
          "keyword": keyword,
          "signimg": imgToBase64($img.get(0)).split(',')[1]
        }
      };

      // 创建二维码 -> 关键字签章
      createSignQrCode(params, keySignUrl, function (response) {
        let verify = response.msg.verify;

        epTools.downloadUrl = response.msg.url;

        if (Array.isArray(verify) && verify.length >= 1) {
          let imgEl = document.createElement('img'),
            imgSrc = 'data:image/png;base64,' + verify[0].signImg;

          imgEl.src = imgSrc;
          imgEl.onload = function () {
            let imgWidth = this.width,
              imgHeight = this.height;

            $.each(verify, function (i, e) {
              let pageNumber = e.page,
                isIntegrity = e.isIntegrity,
                $pageEl = $viewerContainer.find(
                  '.page[data-page-number=' + pageNumber +
                  ']'),
                pageEl = $pageEl.get(0);

              if (pageEl && pageEl.nodeType == 1) {
                // 有关键字的页面已经加载的话
                if ($pageEl.attr('data-loaded')) {
                  let $curTextEle = $pageEl.find(
                    '.textLayer div:contains(' + keyword +
                    ')');

                  $.each($curTextEle, function (_i, _e) {
                    let $_e = $(_e);
                    let top = parseInt($_e.css(
                        'top'), 10),
                      left = parseInt($_e.css(
                        'left'), 10);

                    let signEl = document.createElement(
                        'div'),
                      signImgEl = document.createElement(
                        'img'),
                      signElTop = top - imgHeight / 2,
                      signElLeft = left - imgWidth / 2 +
                      $_e.outerWidth() / 2,
                      tmp = {},
                      signid = e.signid;

                    signImgEl.src = imgSrc;
                    signEl.className = '_addSign';
                    signEl.dataset.signid = signid;
                    signImgEl.className = '_signimg';
                    tmp[signid] = e;
                    signInformation.push(tmp);

                    $(signEl).css({
                      left: signElLeft,
                      top: signElTop
                    });

                    $(signImgEl).css({
                      width: imgWidth,
                      height: imgHeight
                    });

                    signEl.appendChild(signImgEl);
                    pageEl.appendChild(signEl);

                    if (!!isIntegrity) {
                      // TODO: 创建签章状态标识 isIntegrity 为 true
                      createSignStatusImg('success',
                        signid, epTools.AfterSignPDF);
                    } else {
                      // 创建签章状态标识 isIntegrity 为 false
                      window.isSignIntegrity = false;
                      createSignStatusImg('error',
                        signid, epTools.AfterSignPDF);
                    }

                    window.signCount += 1;

                    // 添加到数字签名区域
                    addToAnnotationView(e);
                    signElArray.push({
                      pageNumber: pageNumber,
                      signid: signid,
                      signEl: signEl,
                      isIntegrity: isIntegrity,
                      scale: PDFViewerApplication.toolbar
                        .pageScale,
                      imgWidth: imgWidth,
                      imgHeight: imgHeight,
                      top: signElTop,
                      left: signElLeft,
                      pageRotation: PDFViewerApplication
                        .pageRotation
                    });
                  });
                } else {
                  keyWordSignNotLoadedData.push(e);
                }
              } else {
                keyWordSignNotLoadedData.push(e);
              }
            });
          };
        } else {
          alert('此pdf无 keyword 关键字');
          return;
        }
      });
    },

    /**
     * 输入指定位置盖章
     * @param {Number} pageNumber 签章页码
     * @param {Number} left x
     * @param {Number} top y
     */
    positionSign: function (pageNumber, left, top) {
      if (typeof pageNumber !== 'number') {
        console.error('请输入第几页签章');
        return;
      }

      if (typeof left !== 'number') {
        console.error('请输入 x 轴坐标');
        return;
      }

      if (typeof top !== 'number') {
        console.error('请输入 y 轴坐标');
        return;
      }

      let div = document.createElement('div'),
        img = document.createElement('img'),
        scale = PDFViewerApplication.toolbar.pageScale;

      div.className = '_addSign';
      img.src = $signaturePreview.find('img').prop('src');
      img.className = '_signimg';

      $(div).css({
        left: left,
        top: top
      });
      div.appendChild(img);

      let imgBase64 = imgToBase64(img) || '';

      if (imgBase64.indexOf('base64') !== -1) {
        imgBase64 = imgBase64.split(',')[1];
      }

      img.onload = function () {
        let imgWidth = this.width,
          imgHeight = this.height;

        let x = (left + imgWidth / 2) / scale * 0.75,
          y = (top + imgHeight / 2) / scale * 0.75,
          userId = epTools.getUserId();

        // 生成签章二维码 -> 指定位置签章
        createSignQrCode({
          "userid": userId,
          "sign": {
            "signimg": imgBase64,
            "positions": [{
              "page": pageNumber,
              "x": x,
              "y": y
            }]
          }
        }, comSignUrl, function (response) {
          createSignCallback(response, top, left);
        });
      }
    }
  });

  /**
   * 选择签章类型为普通签章方法
   */
  function createSignElement() {
    let pageScale = PDFViewerApplication.toolbar.pageScale;

    sign_img = document.createElement('img');
    sign_div = document.createElement('div');

    sign_img.src = $signaturePreview.find('img').prop('src');
    sign_img.onload = function () {
      $(sign_img).css({
        width: sign_img.width * pageScale,
        height: sign_img.height * pageScale
      });
    };

    sign_div.appendChild(sign_img);
    $(sign_div).addClass('movesign');
    $(sign_div).css({
      position: 'absolute',
      textAlign: 'center'
    });

    isOpenSig = true;
  }

  /**
   * TODO: 创建签章二维码
   * @param {Object} params 参数
   * @param {String} url 接口地址
   * @param {Function} successCallback 成功回调函数
   */
  function createSignQrCode(params, url, successCallback) {
    let type = epTools.type,
      msg = epTools.msg;

    let formData = new FormData();

    if (type == 'url') {
      params.pdf = {
        type: type,
        msg: msg
      };

      formData.append('params', JSON.stringify(params));
    } else if (type == 'file') {
      params.pdf = {
        type: type,
        msg: ''
      };

      formData.append('params', JSON.stringify(params));
      formData.append('file', msg);
    }

    $.ajax({
      type: "post",
      url: url,
      data: formData,
      processData: false,
      contentType: false,
      dataType: 'json',
      timeout: 5000,
      success: function (response) {
        let qrcodeid = response.msg.qrcodeid;

        if (response.status == 'ok' && qrcodeid && typeof qrcodeid ==
          'string') {
          qrcode.clear();
          $('#qrcodeContainer').removeClass('hidden');
          $('#mask').removeClass('hidden');
          qrcode.makeCode(JSON.stringify(response.msg));
          // 挂起验证
          verifyQrCodeHasUse(qrcodeid, successCallback);
          // TODO: 模拟接口扫描
          if (window.openMockScan) {
            mockScan(qrcodeid);
          }
        } else {
          console.error('生成二维码失败');
        }
      },
      error: function () {
        console.error('生成二维码失败');
      }
    });
  }

  /**
   * 验证签章二维码是否已经使用了
   * @param {String} qrcodeid 二维码id
   * @param {Function} successCallback status为ok 成功回调函数
   */
  function verifyQrCodeHasUse(qrcodeid, successCallback) {
    let formdata = new FormData();

    formdata.append('params', JSON.stringify({
      qrcodeid: qrcodeid
    }));

    time = setTimeout(function polling() {
      $.ajax({
        url: verifyQrCodeHasUseUrl,
        type: 'post',
        data: formdata,
        dataType: 'json',
        processData: false,
        contentType: false,
        success: function (response) {
          switch (response.status) {
            case 'ok':
              clearTimeout(time);
              $('#qrcodeContainer').addClass('hidden');
              $('#mask').addClass('hidden');
              successCallback && typeof successCallback ==
                'function' && successCallback(response);
              break;

            case 'wait':
              time = setTimeout(function () {
                polling();
              }, 1000);
              break;

            default:
              clearTimeout(time);
              $('#qrcodeContainer').addClass('hidden');
              $('#mask').addClass('hidden');
              alert(response.msg);
              break;
          }
        },
        error: function () {
          console.error('验证二维码扫描失败');
        }
      });
    }, 1000);
  }

  /**
   * 渲染签章信息页面
   * @param {Object} e 签章信息
   */
  function renderSignInformation(e) {
    let cert = e.cert;

    if (e.isIntegrity) {
      e.signCls = 'success';
      e.signDescription = '签名有效，由"' + cert.signer +
        '"签名，自应用本签名以来，"文档"未被修改';
    } else {
      e.signCls = 'error';
      e.signDescription = '签名无效，由"' + cert.signer +
        '"签名，自应用本签名以来，"文档"已被更改或损坏';
    }

    blob_Url = base64ToBlob(cert.base64Cert);

    $uiPopupContent.html(
      `<div>
        <div class="ep-title ${e.signCls}">
          <i class="ep-icon"></i>
          <span>${e.signDescription}</span>
        </div>
      </div>
  
      <div class="ep-content">
        <div class="ep-tab">
          <ul class="ep-nav clearfix">
            <li class="active">
              <a href="javascript:void(0);">签名信息</a>
            </li>
          </ul>
  
        <div class="ep-tab--content">
          <div class="ep-tab-pane active certinfo">
            <div class="ep-meta">
              <div class="ep-item clearfix">
                <label class="ep-label">原因：</label>
                <span class="ep-value">
                  ${e.reason}
                </span>
              </div>
  
              <div class="ep-item clearfix">
                <label class="ep-label">签名日期：</label>
                <span class="ep-value">
                  ${e.signdate}
                </span>
              </div>
  
              <div class="ep-item clearfix">
                <label class="ep-label">签名者：</label>
                <span class="ep-value">
                  ${e.cert.signer}
                  <a href="javascript:void(0);" download class="ep-a-cert">下载证书</a>
                </span>
              </div>
  
              <div class="ep-item clearfix">
                <label class="ep-label" style="width: 18%">证书序列号：</label>
                <span class="ep-value" style="width: 82%">
                  ${e.cert.serialNumber}
                </span>
              </div>
  
              <div class="ep-item clearfix">
                <label class="ep-label">签名算法：</label>
                <span class="ep-value">
                  ${e.cert.sigAlg}
                </span>
              </div>
  
              <div class="ep-item clearfix">
                <label class="ep-label">位置：</label>
                <span class="ep-value">
                  ${e.location}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`
    );
    $uiPopup.addClass('zoomIn animated faster');
    $uiPopup.removeClass('hidden');
  }

  /**
   * img 转 base64
   * @param {HTMLElement} img nodeType = 1
   * @returns {String} base64 转换完成的 base64
   */
  function imgToBase64(img) {
    if (img.nodeType == 1) {
      let canvasEl = document.createElement('canvas'),
        ctx = canvasEl.getContext('2d'),
        imgWidth = img.width,
        imgHeight = img.height;

      canvasEl.width = imgWidth;
      canvasEl.height = imgHeight;

      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

      return canvasEl.toDataURL('image/png');
    }
  }

  /**
   * 绑定工具栏关于新点事件
   */
  function toolbarBindListeners() {
    // 关闭关于新点
    document.getElementById('abountContainer-close').addEventListener(
      'click',
      function () {
        PDFViewerApplication.appConfig.toolbar.aboutContainer.classList.add(
          'hidden');
      });

    // 书签展示
    document.getElementById('viewOutline').addEventListener('click',
      function () {
        PDFViewerApplication.pdfSidebar.switchView(SidebarView.OUTLINE);
      });

    // 验证展示
    document.getElementById('verification').addEventListener('click',
      function () {
        // 验证完毕
        if (typeof window.signCount == 'number' && typeof window.isSignIntegrity ==
          'boolean') {
          if (window.isSignIntegrity) {
            $verifyContainerCon.html(
              `<img src="./images/sign-check-48.png" alt="" class="verifyContainer-icon" />
              <p class="verifyContainer-result">文档未被修改，文档验证有效</p>
              <p class="verifyContainer-count">文档验证完毕，共有签章${window.signCount}个</p>`
            );
          } else {
            $verifyContainerCon.html(
              `<img src="./images/sign-error-48.png" alt="" class="verifyContainer-icon" />
              <p class="verifyContainer-result">文档已经被修改，文档验证失效</p>
              <p class="verifyContainer-count">文档验证完毕，共有签章${window.signCount}个</p>`
            );
          }
        } else {
          $verifyContainerCon.html('请先打开相关 pdf 文件');
        }

        $('#verifyContainer').toggleClass('hidden');
      });

    // 验证展示关闭按钮
    $('#verifyContainer .verifyContainer-close').on('click', function () {
      $('#verifyContainer').addClass('hidden');
    });
  }

  /**
   * addToAnnotationView 添加到数字签名区域
   * @param {Object} data 签章的数据
   */
  function addToAnnotationView(data) {
    data.signdate = getDate(data.signdate);
    data.signImg = 'data:image/png;base64,' + data.signImg;

    PDFViewerApplication.appConfig.sidebar.annotationView.innerHTML +=
      `<div class="annotationView-item" data-id="${data.signid}">
        <p>${data.signid}</p>
        <div>
          <img src="${data.signImg}" alt="" />
        </div>
        <p>${data.integrityText || ''}</p>
        <p>原因：${data.reason}</p>
        <p>项目名称：签章工具</p>
        <p>用户名称：${data.cert.signer}</p>
        <p>印章名称：电子签章</p>
        <p>UK序列号：${data.cert.serialNumber}</p>
        <p>签章时间：${data.signdate}</p>
      </div>`
  }

  /**
   * 创建签章状态标识
   * @param {String} status 签章是否成功 success or error
   * @param {String} signId 签章标识
   * @param {Function} callback 执行回调函数
   */
  function createSignStatusImg(status, signId, callback) {
    let $signDiv = $viewerContainer.find('div[data-signid="' + signId +
      '"]');
    let img = document.createElement('img');
    let pageScale = PDFViewerApplication.toolbar.pageScale;
    let pageRotation = PDFViewerApplication.pageRotation;

    img.src = status === 'success' ? './images/sign-check-48.png' :
      './images/sign-error-48.png';
    img.className = '_signstatus';

    img.onload = function () {
      initSignImgWidth = this.width * pageScale;
      initSignImgHeight = this.height * pageScale;

      $(this).css({
        width: initSignImgWidth,
        height: initSignImgHeight,
        transform: 'rotate(' + pageRotation + 'deg)'
      });
    };

    typeof callback === 'function' && callback.call(epTools);
    $signDiv.append(img);
  }

  function getDate(millisecond) {
    let date = new Date(millisecond);

    return date.getFullYear() + '-' + appendZero(date.getMonth() + 1) + '-' +
      appendZero(date.getDate()) + ' ' + appendZero(date.getHours()) + ':' +
      appendZero(date.getMinutes()) + ':' + appendZero(date.getSeconds());
  }

  function appendZero(sum) {
    if (sum < 10) {
      return '0' + sum;
    }

    return sum;
  }

  function base64ToBlob(b64) {
    // 解码 b64 并且转换成 btype
    // 注意，这边 atob 必须解码的是没有 url 部分的 base64 值，如果带有 url 部分，解码会报错！
    b64 = b64.replace(/\s/g, '');
    let btypes = window.atob(b64);

    // 处理异常，将ascii码小于0的转换为大于0
    let ab = new ArrayBuffer(btypes.length);
    // 生成视图（直接针对内存）：8位无符号整数，长度1个字节
    let ia = new Uint8Array(ab);

    for (let i = 0, len = btypes.length; i < len; i++) {
      ia[i] = btypes.charCodeAt(i);
    }

    return new Blob([ab], {
      type: 'application/x-x509-ca-cert'
    });
  }

  // 渲染页面触发该事件
  let pageDrawCallback = function () {
    let scale = PDFViewerApplication.toolbar.pageScale,
      rotation = PDFViewerApplication.pageRotation;

    /**
     * 渲染页面发生改变的时候，对签章改变做重绘处理
     * @param {Object} e 遍历的参数
     */
    let signReDrawCallback = function (e) {
      if (e) {
        let $el = $viewerContainer.find('[data-page-number="' + e.pageNumber +
            '"]'),
          signEl = e.signEl,
          $signEl = $(signEl),
          $img = $signEl.find('._signimg'),
          width, height, top, left;

        top = e.top / e.scale * scale;
        left = e.left / e.scale * scale;
        width = e.imgWidth / e.scale * scale;
        height = e.imgHeight / e.scale * scale;

        // 如果是多页签章得话要考虑到懒加载未插入的签章 status
        if (selectSignType == 'multiSign' && !$signEl.find(
            '._signstatus').get(0)) {
          if (!!e.isIntegrity) {
            // TODO: 创建签章状态标识 isIntegrity 为 true
            createSignStatusImg('success', e.signid, epTools.AfterSignPDF);
          } else {
            // 创建签章状态标识 isIntegrity 为 false
            createSignStatusImg('error', e.signid, epTools.AfterSignPDF);
          }
        }

        $img.css({
          width: width,
          height: height
        });

        $signEl.find('._signstatus').css({
          width: initSignImgWidth / e.scale * scale,
          height: initSignImgHeight / e.scale * scale
        });

        switch (rotation) {
          case 0:
            $signEl.css({
              top: top,
              left: left,
              bottom: 'auto',
              right: 'auto'
            });
            break;

          case 90:
            $signEl.css({
              top: left,
              left: 'auto',
              right: top,
              bottom: 'auto'
            });
            break;

          case 180:
            $signEl.css({
              top: 'auto',
              left: 'auto',
              bottom: top,
              right: left
            });
            break;

          case 270:
            $signEl.css({
              top: 'auto',
              left: top,
              bottom: left,
              right: 'auto'
            });
            break;
        }

        $signEl.css({
          transform: 'rotate(' + rotation + 'deg)'
        });

        $el.append(e.signEl);
      }
    };

    // 改变页面的时候重新渲染 -> 单页签章、多页签章
    $.each(signElArray, function (i, e) {
      signReDrawCallback(e);
    });

    // 如果是关键字签章的话，可能会存在未 loaded 的页面
    if (selectSignType == 'keyWordSign') {
      if (keyWordSignNotLoadedData && Array.isArray(
          keyWordSignNotLoadedData) && keyWordSignNotLoadedData.length >=
        1) {
        let imgEl = document.createElement('img'),
          imgSrc = 'data:image/png;base64,' + keyWordSignNotLoadedData[0]
          .signImg;

        imgEl.src = imgSrc;
        imgEl.onload = function () {
          let imgWidth = this.width,
            imgHeight = this.height;

          let that = this;

          $.each(keyWordSignNotLoadedData, function (i, e) {
            let pageNumber = e.page;
            let $pageEl = $(
                '#viewerContainer .page[data-page-number="' +
                pageNumber +
                '"]'),
              $curTextEle = $(
                '#viewerContainer .page[data-page-number="' +
                pageNumber +
                '"] .textLayer div:contains("' + signSearchVal +
                '")');

            // 如果有当前关键字签章元素
            $.each($curTextEle, function (_i, _e) {
              let $_e = $(_e),
                top = parseInt($_e.css('top'), 10),
                left = parseInt($_e.css('left'), 10);

              let signEl = document.createElement('div'),
                signImgEl = document.createElement('img'),
                signElTop = top - imgHeight / 2,
                signElLeft = left - imgWidth / 2 + $curTextEle.outerWidth() /
                2,
                tmp = {},
                signid = e.signid,
                isIntegrity = e.isIntegrity;

              signImgEl.src = that.src;
              signEl.className = '_addSign';
              signEl.dataset.signid = signid;
              signImgEl.className = '_signimg';
              tmp[signid] = e;
              signInformation.push(tmp);

              $(signEl).css({
                left: signElLeft,
                top: signElTop
              });

              $(signImgEl).css({
                width: imgWidth,
                height: imgHeight
              });

              signEl.appendChild(signImgEl);
              $pageEl.get(0).appendChild(signEl);

              if (!!isIntegrity) {
                // 创建签章状态标识 isIntegrity 为 true
                createSignStatusImg('success', signid, epTools.AfterSignPDF);
              } else {
                // 创建签章状态标识   isIntegrity 为 false
                window.isSignIntegrity = false;
                createSignStatusImg('error', signid, epTools.AfterSignPDF);
              }

              window.signCount += 1;

              // 添加到数字签名区域
              addToAnnotationView(e);
              signElArray.push({
                pageNumber: pageNumber,
                signid: signid,
                signEl: signEl,
                isIntegrity: isIntegrity,
                scale: PDFViewerApplication.toolbar.pageScale,
                imgWidth: imgWidth,
                imgHeight: imgHeight,
                top: signElTop,
                left: signElLeft,
                pageRotation: PDFViewerApplication.pageRotation
              });

              keyWordSignNotLoadedData.splice(i, 1, undefined);
            });
          });

          keyWordSignNotLoadedData = keyWordSignNotLoadedData.filter(
            function (e) {
              return e !== undefined;
            });
        }
      }
    }
  };

  /**
   * TODO: 模拟签章
   * @param {String} qrcodeid 二维码标识
   */
  function mockScan(qrcodeid) {
    $.get('http://192.168.108.217:8099/H5PDF/qrsign/mockScan?codeid=' +
      qrcodeid);
  }

  // 每次打开文件触发该回调函数
  let openFileCallback = function () {};

  // 每次关闭文件触发该回调函数
  let closeFileCallback = function () {};

  // 每次打开和关闭文件触发该回调函数
  let toggleFileCallback = function () {
    signElArray = [];
    window.signCount = 0;
    window.isSignIntegrity = undefined;
    epTools.downloadUrl = null;

    if (epTools.keyWordSignElArray && Array.isArray(epTools.keyWordSignElArray)) {
      epTools.keyWordSignElArray = [];
    }
  };

  init();

  return {
    openFileCallback: openFileCallback,
    pageDrawCallback: pageDrawCallback,
    closeFileCallback: closeFileCallback,
    toggleFileCallback: toggleFileCallback
  };
}));
