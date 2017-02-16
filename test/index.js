var fs = require('fs');
var path = require('path');
var umdify = require('../umdify');

var dir = path.join(__dirname, 'src');
var files = fs.readdirSync(dir);
files.forEach(function(file) {
    var contents = fs.readFileSync(path.join(dir, file), 'utf8');
    contents = umdify(contents, file.split('.')[0].toUpperCase());
    var dest = path.join(__dirname, 'dist', file);
    fs.writeFileSync(dest, contents);
});
process.exit();