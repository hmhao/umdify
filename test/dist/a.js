(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('jquery','vendor/inherit', factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('jquery'),require('vendor/inherit'));
  } else {
    root.A = factory($,inherit);
  }
}(this, function($,inherit) {


	var A = inherit(new function() {

	});

	return A;

}));


