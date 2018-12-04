/* Copyright 2012 Mozilla Foundation
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

import { FindState } from './pdf_find_controller';
import { NullL10n } from './ui_utils';

/**
 * Creates a "search bar" given a set of DOM elements that act as controls
 * for searching or for setting search preferences in the UI. This object
 * also sets up the appropriate events for the controls. Actual searching
 * is done by PDFFindController.
 */
class PDFFindBar {
  constructor(options, l10n = NullL10n) {
    this.opened = false;

    this.bar = options.bar || null;
    this.findField = options.findField || null;
    this.highlightAll = options.highlightAllCheckbox || null;
    this.caseSensitive = options.caseSensitiveCheckbox || null;
    this.findMsg = options.findMsg || null;
    this.findResultsCount = options.findResultsCount || null;
    this.findStatusIcon = options.findStatusIcon || null;
    this.findPreviousButton = options.findPreviousButton || null;
    this.findNextButton = options.findNextButton || null;
    this.findController = options.findController || null;
    this.eventBus = options.eventBus;
    this.findBarSearchTree = options.findBarSearchTree;
    this.l10n = l10n;

    if (this.findController === null) {
      throw new Error('PDFFindBar cannot be used without a ' +
                      'PDFFindController instance.');
    }

    this.findField.addEventListener('input', () => {
      this.dispatchEvent('');
    });

    this.bar.addEventListener('keydown', (e) => {
      switch (e.keyCode) {
        case 13: // Enter
          if (e.target === this.findField) {
            this.dispatchEvent('again', e.shiftKey);
          }
          break;

        case 27: // Escape
          this.close();
          break;
      }
    });

    this.findPreviousButton.addEventListener('click', () => {
      this.dispatchEvent('again', true);
    });

    this.findNextButton.addEventListener('click', () => {
      this.dispatchEvent('again', false);
    });

    this.highlightAll.addEventListener('click', () => {
      this.dispatchEvent('highlightallchange');
    });

    this.caseSensitive.addEventListener('click', () => {
      this.dispatchEvent('casesensitivitychange');
    });

    this.eventBus.on('resize', this._adjustWidth.bind(this));
  }

  reset() {
    this.updateUIState();
  }

  dispatchEvent(type, findPrev) {
    this.eventBus.dispatch('find', {
      source: this,
      type,
      query: this.findField.value,
      caseSensitive: this.caseSensitive.checked,
      phraseSearch: true,
      highlightAll: this.highlightAll.checked,
      findPrevious: findPrev,
    });
  }

  updateUIState(state, previous, matchCount) {
    let notFound = false;
    let findMsg = '';
    let status = '';

    switch (state) {
      case FindState.FOUND:
        break;

      case FindState.PENDING:
        status = 'pending';
        break;

      case FindState.NOT_FOUND:
        findMsg = this.l10n.get('find_not_found', null, 'Phrase not found');
        notFound = true;
        break;

      case FindState.WRAPPED:
        if (previous) {
          findMsg = this.l10n.get('find_reached_top', null,
            'Reached top of document, continued from bottom');
        } else {
          findMsg = this.l10n.get('find_reached_bottom', null,
            'Reached end of document, continued from top');
        }
        break;
    }

    if (notFound) {
      this.findField.classList.add('notFound');
    } else {
      this.findField.classList.remove('notFound');
    }

    this.findField.setAttribute('data-status', status);
    Promise.resolve(findMsg).then((msg) => {
      this.findMsg.textContent = msg;
      this._adjustWidth();
    });

    this.updateResultsCount(matchCount);
  }

  /**
   * 加入 matchesCount 对比
   */
  requestMatchesCount() {
    const findController = PDFViewerApplication.findController;
    const { pageIdx, matchIdx } = findController.selected;
    let current = 0, total = findController.matchCount;

    if (matchIdx !== -1) {
      for (let i = 0; i < pageIdx; i++) {
        current += (findController.pageMatches[i] && findController.pageMatches[i].length) || 0;
      }
      current += matchIdx + 1;
    }

    // When searching starts, this method may be called before the `pageMatches`
    // have been counted (in `_calculateMatch`). Ensure that the UI won't show
    // temporarily broken state when the active find result doesn't make sense.
    if (current < 1 || current > total) {
      current = total = 0;
    }
    
    return { current, total, };
  }

  updateResultsCount(matchCount) {
    if (!this.findResultsCount) {
      return; // No UI control is provided.
    }

    if (!matchCount) {
      // If there are no matches, hide and reset the counter.
      this.findResultsCount.classList.add('visibilityHidden');
      this.findBarSearchTree.classList.add('hidden');
      this.findResultsCount.innerHTML = '';
      this.findBarSearchTree.innerHTML = '';
    } else {
      // Update and show the match counter.
      let currentIdx = this.requestMatchesCount().current;

      this.findResultsCount.innerHTML = '结果：<span style="color: #4788d8;">' + currentIdx + '</span>/' + matchCount.toLocaleString();
      this.findResultsCount.classList.remove('visibilityHidden');
      this.findBarSearchTree.classList.remove('hidden');
      // 有搜索结果的话，就渲染搜索树
      this._renderSearchTree(currentIdx);
    }
    // Since `updateResultsCount` may be called from `PDFFindController`,
    // ensure that the width of the findbar is always updated correctly.
    this._adjustWidth();
  }

  /**
   * @private
   * @param {Number} currentIdx 当前选中第几个
   */
  _renderSearchTree(currentIdx) {
    const searchTree = PDFViewerApplication.findController.searchTree;
    let result = '';

    for (let i = 0, len = searchTree.length; i < len; i++) {
      let item = searchTree[i];
      let query = item.query;
      let content = item.content;

      if (i + 1 === currentIdx) {
        result += 
        `<div class="findbarSearchTree-item" title="${content}">
          <i class="findbarSearchTree-item--icon active"></i>
          (P${item.page})${content.replace(new RegExp(query), '<span style="background-color: #f8f180;">'+ query +'</span>')}
        </div>`;
      }
      else {
        result += 
      `<div class="findbarSearchTree-item">
        <i class="findbarSearchTree-item--icon"></i>
        (P${item.page})${content.replace(new RegExp(query), '<span style="background-color: #f8f180;">'+ query +'</span>')}
      </div>`;
      }
    }

    this.findBarSearchTree.innerHTML = result;
  }

  open() {
    if (!this.opened) {
      this.opened = true;
      this.bar.classList.remove('hidden');
    }
    this.findField.select();
    this.findField.focus();

    this._adjustWidth();
  }

  close() {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.bar.classList.add('hidden');
    this.findController.active = false;
  }

  /**
   * @private
   */
  _adjustWidth() {
    if (!this.opened) {
      return;
    }

    // The find bar has an absolute position and thus the browser extends
    // its width to the maximum possible width once the find bar does not fit
    // entirely within the window anymore (and its elements are automatically
    // wrapped). Here we detect and fix that.
    this.bar.classList.remove('wrapContainers');

    let findbarHeight = this.bar.clientHeight;
    let inputContainerHeight = this.bar.firstElementChild.clientHeight;

    if (findbarHeight > inputContainerHeight) {
      // The findbar is taller than the input container, which means that
      // the browser wrapped some of the elements. For a consistent look,
      // wrap all of them to adjust the width of the find bar.
      this.bar.classList.add('wrapContainers');
    }
  }
}

export {
  PDFFindBar,
};