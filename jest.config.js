module.exports = {
  moduleNameMapper: {
    // force resolve `axios` module as CommonJS
    // axios@>1.0.0 breaks in jest otherwise
    '^axios$': require.resolve('axios'),
  },
};
