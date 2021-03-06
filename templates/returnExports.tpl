<%= before %>(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(<%= amd %>, factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(<%= cmd %>);
  } else {
    root.<%= namespace %> = factory(<%= global %>);
  }
}(this, function(<%= param %>) {
<%= contents %>
}));<%= after %>
