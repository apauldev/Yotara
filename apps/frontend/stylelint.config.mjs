export default {
  customSyntax: 'postcss-scss',
  ignoreFiles: ['src/styles.css', '**/dist/**', '**/.angular/**'],
  plugins: ['./stylelint-no-hardcoded-color.mjs'],
  rules: {
    'color-no-hex': true,
    'yotara/no-hardcoded-color': true,
  },
};
