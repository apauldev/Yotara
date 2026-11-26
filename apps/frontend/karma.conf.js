module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {},
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu'],
      },
    },
    restartOnFileChange: true,
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/frontend'),
      subdir: '.',
      // Baselines recorded 2026-11-25: 92.66% statements, 83.4% branches,
      // 92.24% functions, 93.38% lines. Thresholds sit ~2 points below so
      // small measurement variance does not break CI, but a real drop does.
      check: {
        global: {
          statements: 90,
          branches: 81,
          functions: 90,
          lines: 91,
        },
      },
      reporters: [
        { type: 'html' },
        { type: 'lcovonly', file: 'lcov.info' },
        { type: 'text-summary' },
      ],
    },
  });
};
