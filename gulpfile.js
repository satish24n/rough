/*global -$ */
'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

var exec = require('child_process').exec;

var browserSync = require('browser-sync');
var reload = browserSync.reload;

var parallel = require('concurrent-transform');
var os = require('os');

// Styles with Libsass (on its way in)
gulp.task('styles', function () {
	return gulp.src('app/styles/main.scss')
		.pipe($.sourcemaps.init())
		.pipe($.sass({
			outputStyle: 'nested', // libsass doesn't support expanded yet
			precision: 10,
			includePaths: ['.'],
			require: 'susy',
			onError: console.error.bind(console, 'Sass error:')
		}))
		.pipe($.postcss([
			require('autoprefixer-core')({ browsers: [
				'last 2 version', 'android 4', 'ios 7', 'ie 10'
			]})
		]))
		.pipe($.sourcemaps.write())
		.pipe(gulp.dest('.tmp/styles'))
		.pipe($.filter('**/*.css')) // Filtering stream to only css files. Needed for browser-sync css injection
		.pipe(reload({stream: true}));
});

// Styles with Ruby Sass (on its way out)
gulp.task('styles-ruby', function() {
	return $.rubySass('app/styles/main.scss', {
			sourcemap: true,
			precision: 10,
			require: 'susy',
			bundleExec: true
		})
		.on('error', function(err) {
			console.error('Error', err.message);
		})
		.pipe($.postcss([
			require('autoprefixer-core')({ browsers: [
				'last 2 version', 'android 4', 'ios 7', 'ie 10'
			]})
		]))
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest('.tmp/styles'))
		.pipe($.filter('**/*.css')) // Filtering stream to only css files. Needed for browser-sync css injection
		.pipe(reload({stream: true}));
});

// Lint all scripts except those inside scripts/vendor
gulp.task('jshint', function () {
	return gulp.src(['app/scripts/**/*.js', '!app/scripts/vendor/**/*.js'])
		.pipe(reload({stream: true, once: true}))
		.pipe($.jshint())
		.pipe($.jshint.reporter('jshint-stylish'))
		.pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Compile .jade into .html in the .tmp dir
gulp.task('views', function () {
	return gulp.src('app/*.jade')
		.pipe($.jade({pretty: true}))
		.pipe(gulp.dest('.tmp'));
});

gulp.task('html', ['views', 'styles'], function () {
	var assets = $.useref.assets({searchPath: ['.tmp', 'app', '.']});

	return gulp.src(['.tmp/*.html'])
		.pipe(assets)
		.pipe($.if('*.js', $.uglify()))
		.pipe($.if('*.css', $.csso()))
		.pipe($.rev())
		.pipe(assets.restore())
		.pipe($.useref())
		.pipe($.revReplace())
		.pipe(gulp.dest('dist'));
});

gulp.task('images', function () {
	return gulp.src('app/images/**/*')
		.pipe($.cache($.imagemin({
			progressive: true,
			interlaced: true,
			// don't remove IDs from SVGs, they are often used
			// as hooks for embedding and styling
			svgoPlugins: [{cleanupIDs: false}]
		})))
		.pipe(gulp.dest('dist/images'));
});

// https://github.com/DevWorkflows/gulp-example-image-optimization/blob/master/gulpfile.js
// https://docs.google.com/a/rough.dk/document/d/1QIVInc5U0svmQUEfb1sNTy8mY5vwIFZ32F9mfyB5ovc/edit#heading=h.u3oxm1f4og9w
// https://github.com/sindresorhus/gulp-imagemin

gulp.task('oskar', function () {
	gulp.src('app/images/test.jpg')
		.pipe($.imageResize({
			width : 1440,
			crop : true,
			upscale : false,
			quality: 1, //	Ranges from 0 (really bad) to 1 (almost lossless). Only applies to jpg images.
			sharpen: true // slight unsharp mask after resizing
		}))
		.pipe(gulp.dest('dist'));
});

gulp.task('parallel', function () {
	gulp.src('app/images/**/*.{jpg,png}')
		.pipe(parallel(
			$.imageResize({ width : 100 }),
			os.cpus().length
		))
		.pipe(gulp.dest('dist'));
});

gulp.task('changed', function () {
	gulp.src('app/images/**/*.{jpg,png}')
		.pipe($.changed('dist'))
		.pipe($.imageResize({ width : 100 }))
		.pipe(gulp.dest('dist'));
});

gulp.task('suffix', function () {
	gulp.src('app/images/**/*.{jpg,png}')
		.pipe($.imageResize({ width : 100 }))
		.pipe($.rename(function (path) { path.basename += '-thumbnail'; }))
		.pipe(gulp.dest('dist'));
});

gulp.task('fonts', function () {
	return gulp.src(require('main-bower-files')({
		filter: '**/*.{eot,svg,ttf,woff,woff2}'
	}).concat('app/fonts/**/*'))
		.pipe(gulp.dest('.tmp/fonts'))
		.pipe(gulp.dest('dist/fonts'));
});

gulp.task('extras', ['move-icons'], function () {
	return gulp.src([
		'app/*.*',
		'!app/*.html',
		'!app/*.jade'
	], {
		dot: true
	}).pipe(gulp.dest('dist'));
});

gulp.task('move-icons', function () {
	return gulp.src(['.tmp/images/icons/**/*'])
		.pipe(gulp.dest('dist/images/icons'));
});

// Runs grunticon directly from grunt
gulp.task('icons', function (cb) {
	exec('grunt grunticon', function (err, stdout, stderr) {
		console.log(stdout);
		console.log(stderr);
		cb(err);
	});
});

gulp.task('clean', require('del').bind(null, ['.tmp', 'dist']));
gulp.task('s', ['serve']);
gulp.task('serve', ['views', 'styles', 'fonts', 'icons'], function () {
	browserSync({
		notify: false,
		port: 9000,
		server: {
			baseDir: ['.tmp', 'app'],
			routes: {
				'/bower_components': 'bower_components'
			}
		}
	});

	// watch for changes
	gulp.watch([
		// 'app/*.html',
		'app/scripts/**/*.js',
		'app/images/**/*',
		'.tmp/fonts/**/*'
	]).on('change', reload);

	gulp.watch('app/**/*.jade', ['views', reload]);
	gulp.watch('app/styles/**/*.scss', ['styles']);
	gulp.watch('app/images/icons/*.{svg,png}', ['icons', reload]);
	gulp.watch('app/fonts/**/*', ['fonts']);
	gulp.watch('bower.json', ['wiredep', 'fonts']);
});

// inject bower components
gulp.task('wiredep', function () {
	var wiredep = require('wiredep').stream;

	gulp.src('app/styles/*.scss')
		.pipe(wiredep({
			ignorePath: /^(\.\.\/)+/
		}))
		.pipe(gulp.dest('app/styles'));

	gulp.src('app/templates/layout.jade')
		.pipe(wiredep({
			ignorePath: /^(\.\.\/)*\.\./
		}))
		.pipe(gulp.dest('app/templates'));
});

gulp.task('build', ['jshint', 'html', 'images', 'fonts', 'extras'], function () {
	return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('default', ['clean', 'icons'], function () {
	gulp.start('build');
});
