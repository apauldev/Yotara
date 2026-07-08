const ruleName = 'no-hardcoded-color-in-styles';

const colorPattern = /(^|[^#\w-])(#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|hsla?\(\s*\d)/;

function checkText(node, text, context) {
  if (!/[{};:]/.test(text)) return;
  for (const decl of text.split(';')) {
    if (/var\(|color-mix\(/i.test(decl)) continue;
    const match = decl.match(colorPattern);
    if (match) {
      context.report({
        node,
        messageId: 'rejected',
        data: { value: (match[2] || match[0]).trim() },
      });
      return;
    }
  }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hard-coded colors in Angular component styles',
    },
    schema: [],
    messages: {
      rejected: 'Hard-coded color "{{value}}" in component styles. Use a theme token (var(--...)).',
    },
  },
  create(context) {
    return {
      Decorator(node) {
        const expr = node.expression;
        if (expr?.type !== 'CallExpression') return;
        const callee = expr.callee;
        if (callee?.type !== 'Identifier' || callee.name !== 'Component') return;
        const arg = expr.arguments?.[0];
        if (!arg || arg.type !== 'ObjectExpression') return;

        for (const prop of arg.properties) {
          if (prop.type !== 'Property') continue;
          const key = prop.key;
          const name = key?.type === 'Identifier' ? key.name : key?.value;
          if (name !== 'styles') continue;

          const value = prop.value;
          const visitString = (stringNode, raw) => checkText(stringNode, raw, context);

          if (value.type === 'ArrayExpression') {
            for (const element of value.elements) {
              if (!element) continue;
              if (element.type === 'TemplateLiteral') {
                for (const quasi of element.quasis) visitString(quasi, quasi.value.raw);
              } else if (element.type === 'Literal' && typeof element.value === 'string') {
                visitString(element, element.value);
              }
            }
          } else if (value.type === 'TemplateLiteral') {
            for (const quasi of value.quasis) visitString(quasi, quasi.value.raw);
          } else if (value.type === 'Literal' && typeof value.value === 'string') {
            visitString(value, value.value);
          }
        }
      },
    };
  },
};

export default { rules: { [ruleName]: rule } };
