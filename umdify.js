'use strict';


var esprima = require('esprima');
var path = require('path');
var fs = require('fs');
var tpl = require('lodash.template');

var MAGIC_DEPS = {
	'exports' : true,
	'module' : true,
	'require' : true
};


var _traverse = function(node, visitor) {
	if (!node) {
		return;
	}

	if (visitor.call(null, node) === false) {
		return false;
	}

	for (var key in node) {
		if (node.hasOwnProperty(key)) {
			var child = node[key];
			if (typeof child === 'object' && child !== null) {
				if (_traverse(child, visitor) === false) {
					return false;
				}
			}
		}
	}
};


var _getDefine = function(ast) {
	var defines = [];

	_traverse(ast, function(node) {
		if (
			node &&
			node.type === 'ExpressionStatement' &&
			node.expression.type === 'CallExpression' &&
			node.expression.callee.type === 'Identifier' &&
			node.expression.callee.name === 'define'
		) {
			defines.push(node);
		}
	});

	if (!defines.length) {
		throw new Error('AMD modules must contain a define() call');
	}

	if (defines.length > 1) {
		throw new Error('AMD modules can have only a single define call. Found '+ defines.length + '.');
	}

	return defines[0];
};


// define(['mod1', 'mod2']...
var _getArrayDependencies = function(ast) {
	var factory = _getDefine(ast);
	var names = [];
	var identifiers = [];
	var args = factory.expression['arguments'];

	for (var i = 0; i < args.length; i++) {
		if (args[i].type === 'ArrayExpression') {
			names = args[i].elements.map(function(obj) {
				return obj.value;
			});
			identifiers = args[i + 1].params.map(function(obj) {
				return obj.name;
			});
		}
	}

	return names.map(function(name, i) {
		return {
			modName: name,
			varIdentifier: identifiers[i]
		};
	});
};


// var mod1 = require('mod1')
var _getCjsDependencies = function(ast) {
	var deps = [];

	_traverse(ast, function(node) {
		if (
			node &&
			node.type === 'CallExpression' &&
			node.callee &&
			node.callee.type === 'Identifier' &&
			node.callee.name === 'require' &&
			node['arguments'] &&
			node['arguments'].length === 1 &&
			node['arguments'][0].type === 'Literal'
		) {
			deps.push(node['arguments'][0].value);
		}
	});

	return deps;
};


// convert amd dependency array to simplified cjs style
var _makeRequireStatements = function(deps) {
	var ret = [];
	var paramNames = [];
	deps.forEach(function(dep){
		if (MAGIC_DEPS[dep.varIdentifier] && !MAGIC_DEPS[dep.modName]) {
			// if user remaped magic dependency we declare a var
			ret.push(dep.modName);
		}
		else if (dep.varIdentifier && !MAGIC_DEPS[dep.varIdentifier]) {
			// only do require for params that have a matching dependency
			// also skip "magic" dependencies
			ret.push('require(\'' + dep.modName + '\')');
		}
		paramNames.push(dep.varIdentifier)
	});
	return {paramNames: paramNames, requires: ret};
};

var defaultOptions = {
	namespace: 'returnExports',
	template: path.join(__dirname, 'templates/returnExports.tpl')
};

// Convert AMD-style JavaScript string into node.js compatible module
var umdify = function(contents, options) {
	options = Object.assign({}, defaultOptions, options);

	var template;

	if(options.templateSource) {
		template = options.templateSource;
	} else {
		template = fs.readFileSync(options.template);
	}

	var ast = esprima.parse(contents, {
		range: true,
		raw: true
	});

	var def = _getDefine(ast);
	var factory = def.expression['arguments'].filter(function(arg) {
		return arg.type === 'FunctionExpression';
	})[0];

	var bodyAst = factory.body;
	var useStrict = bodyAst.body.filter(function(node) {
		return node.type === 'ExpressionStatement' &&
				node.expression.type === 'Literal' &&
				node.expression.value === 'use strict';
	})[0];

	var cjsDeps = _getCjsDependencies(ast);
	var arrayDeps = _getArrayDependencies(ast);
	// cjs-style require() statements for array deps
	var requireStatements = _makeRequireStatements(arrayDeps.filter(function(dep) {
		return cjsDeps.indexOf(dep.modName) === -1;
	}));
	var depNames = arrayDeps
		.map(function(dep) {
			return dep.modName;
		})
		.concat(cjsDeps)
		.map(function(dep) {
			return '\'' + dep + '\'';
		});

	depNames = depNames.reverse().filter(function(name, i, list) {
		return list.indexOf(name, i+1) === -1;
	}).reverse();

	var data = require('lodash.omit')(options,['template', 'templateSource']);
	data.amd = depNames.length ?  depNames : ['[]'];
	data.cmd = requireStatements.requires;
	data.param = requireStatements.paramNames;
	data.global = data.param;

	// anything before define
	data.before = contents.substring(0, def.range[0]);
	// module body
	data.contents = '';
	if (useStrict) {
		data.contents += '\'use strict\';\n\n';
		data.contents += contents.substring(useStrict.expression.range[1] + 1, bodyAst.range[1] - 1);
	}else{
		data.contents += contents.substring(bodyAst.range[0] + 1, bodyAst.range[1] - 1);
	}
	// anything after define
	data.after = contents.substring(def.range[1], contents.length);
	return tpl(template)(data);
};

module.exports = umdify;
