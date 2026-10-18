// ==UserScript==
// @name         亞洲大學講座報名驗證碼自動秒填
// @namespace    https://github.com/pinchiu/asia-lecture-grabber
// @version      1.0.0
// @description  自動辨識並填入亞洲大學講座線上報名系統之4位數圖形驗證碼，免去手動輸入煩惱
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
      if (vm && vm.identifyCode && vm.veriftyCode !== undefined) {
        if (vm.veriftyCode !== vm.identifyCode) {
          vm.veriftyCode = vm.identifyCode;
          console.log('[亞洲大學講座助手] 已自動秒填驗證碼：', vm.identifyCode);
        }
        return true;
      }
      if (vm && vm.$children) {
        for (const child of vm.$children) {
          if (traverse(child)) return true;
        }
      }
      return false;
    }

    traverse(app.__vue__);
  }

  setInterval(autoFill, 250);
})();
