const gulp = require('gulp');
const shell = require('gulp-shell');

// Lints our scripts with XO as defined in `package.json`.
gulp.task('test', callback => {
	shell.task(['xo']);
	callback();
});