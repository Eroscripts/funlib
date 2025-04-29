import antfu from '@antfu/eslint-config'

export default antfu({

})
  .overrideRules({
    'no-console': 'off',
    'antfu/no-top-level-await': 'off',
    'antfu/if-newline': 'off',
    'style/max-statements-per-line': 'off',
    'one-var': 'off',
    'node/prefer-global/process': ['warn', 'always'],
    'style/brace-style': 'off',
    'prefer-template': 'off',
  })
