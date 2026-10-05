(function () {
  const getStatus = () => document.getElementById('boot-status');

  function showError(message) {
    const status = getStatus();
    if (!status) return;
    status.classList.add('error');
    status.textContent =
      '页面初始化失败。\n\n' +
      message +
      '\n\n请同时查看浏览器开发者工具 Console / Network。';
  }

  window.AluminumCadBoot = {
    ready() {
      const status = getStatus();
      if (status) status.remove();
    },
    error: showError
  };

  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && (target.src || target.href)) {
      showError('静态资源加载失败：' + (target.src || target.href));
      return;
    }
    if (event.message) {
      showError(event.message + (event.filename ? '\n' + event.filename + ':' + event.lineno : ''));
    }
  }, true);

  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    showError(reason?.stack || reason?.message || String(reason || 'Promise 执行失败'));
  });

  setTimeout(() => {
    if (getStatus()) {
      showError(
        '应用 8 秒内未完成初始化。最常见原因是 Three.js / ES Module 静态资源返回 404。\n' +
        '请检查：/vendor/three/build/three.module.min.js\n' +
        '以及：/vendor/three/examples/jsm/controls/OrbitControls.js'
      );
    }
  }, 8000);
})();
