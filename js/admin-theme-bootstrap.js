(function () {
    try {
        var stored = localStorage.getItem('sisweb:theme');
        var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
        var effective = mode === 'system'
            && window.matchMedia
            && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light'
            : mode === 'system' ? 'dark' : mode;
        document.documentElement.setAttribute('data-theme', effective);
        document.documentElement.setAttribute('data-theme-mode', mode);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', effective === 'light' ? '#f8f9fa' : '#121417');
    } catch (_) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();