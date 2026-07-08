import stylelint from 'stylelint';

const ns = stylelint.default ?? stylelint;
const { createPlugin, utils } = ns;
const { report, ruleMessages } = utils;

const ruleName = 'yotara/no-hardcoded-color';

const messages = ruleMessages(ruleName, {
  rejected: (value) => `Unexpected hard-coded color "${value}". Use a theme token (var(--...)).`,
});

const colorPattern = /(^|[^#\w-])(#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|hsla?\(\s*\d)/;

const ruleFunction = (primary) => {
  return (root, result) => {
    if (!primary) return;

    root.walkDecls((decl) => {
      const value = decl.value;
      if (/var\(|color-mix\(/i.test(value)) return;

      const match = value.match(colorPattern);
      if (match) {
        report({
          result,
          ruleName,
          node: decl,
          message: messages.rejected(match[2] || match[0].trim()),
        });
      }
    });
  };
};

export default createPlugin(ruleName, ruleFunction);
