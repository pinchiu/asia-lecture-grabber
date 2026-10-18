// ==UserScript==
// @name         亞洲大學講座報名驗證碼與無障礙秒填助手
// @namespace    https://github.com/pinchiu/asia-lecture-grabber
// @version      1.1.0
// @description  自動辨識並填入亞洲大學講座報名系統之4位數驗證碼，並自動選取無障礙空間需求（預設為無需求），支援手動搶課零阻礙
// @author       pinchiu
// @match        https://webap.asia.edu.tw/cfd2020/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  function autoFill() {
    const app = document.querySelector('#app');
    if (!app || !app.__vue__) return;

    function traverse(vm) {
      if (!vm) return;

      // 1. 自動秒填 4 位數驗證碼
      if (vm.identifyCode && vm.veriftyCode !== undefined) {
        if (vm.veriftyCode !== vm.identifyCode) {
          vm.veriftyCode = vm.identifyCode;
          console.log('[亞洲大學講座助手] 已自動秒填驗證碼：', vm.identifyCode);
        }
      }

      // 2. 自動選取無障礙空間需求為「否(N)」（若尚未填寫）
      if (vm.std_info && typeof vm.std_info === 'object') {
        if (!vm.std_info.bfree) {
          if (typeof vm.SWITCH === 'function') {
            vm.SWITCH(1, 'N');
          } else {
            vm.std_info.bfree = 'N';
          }
          console.log('[亞洲大學講座助手] 已自動選擇無障礙空間需求：否(N)');
        }
      }

      if (vm.$children && Array.isArray(vm.$children)) {
        for (const child of vm.$children) {
          traverse(child);
        }
      }
    }

    traverse(app.__vue__);
  }

  setInterval(autoFill, 250);
})();
