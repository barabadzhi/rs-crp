'use strict';

const gulp = require('gulp');
const fs = require('fs-extra');

const browserSync = require('browser-sync').create();
const ngrok = require('ngrok');
const psi = require('psi');

const useref = require('gulp-useref');
const gulpif = require('gulp-if');

const uglify = require('gulp-uglify');
const minify = require('gulp-clean-css');
const htmlmin = require('gulp-htmlmin');

const inlinecss = require('gulp-inline-css');
const inlinesource = require('gulp-inline-source');

let port = 3221;
let site = '';

gulp.task('assets', function(done) {
    fs.ensureDirSync('dist/assets/');
    fs.copy('src/img/', 'dist/assets/', function(err) {
        if (err) {
            console.error(err);
        }
        fs.remove('dist/assets/.gitignore', function(err) {
            if (err) {
                console.error(err)
            }
            done();
        });
    });
});

gulp.task('build-useref', function() {
    return gulp.src('src/*.html')
        .pipe(useref())
        .pipe(gulpif('*.js', uglify()))
        .pipe(gulpif('*.css', minify()))
        .pipe(gulpif('*.html', inlinesource()))
        .pipe(gulpif('*.html', inlinecss({
            removeStyleTags: false,
        })))
        .pipe(gulpif('*.html', htmlmin({
            collapseWhitespace: true,
            removeComments: true
        })))
        .pipe(gulp.dest('dist'));
});

gulp.task('browser-sync', function(done) {
    browserSync.init({
        port,
        open: false,
        server: {
            baseDir: 'dist'
        }
    });
    done();
});

gulp.task('ngrok', function(done) {
    return ngrok.connect(port, function(err, url) {
        site = url;
        console.log('ngrok serving your tunnel from: ' + site);
        done();
    });
});

gulp.task('psi-mobile', function(done) {
    psi(site, {
        nokey: 'true',
        strategy: 'mobile'
    }).then(function(data) {
        console.log('[mobile] Speed score: ' + data.ruleGroups.SPEED.score);
        console.log('[mobile] Usability score: ' + data.ruleGroups.USABILITY.score);
        done();
    });
});

gulp.task('psi-desktop', function(done) {
    psi(site, {
        nokey: 'true',
        strategy: 'desktop'
    }).then(function(data) {
        console.log('[desktop] Speed score: ' + data.ruleGroups.SPEED.score);
        done();
    });
});

gulp.task('psi', gulp.series('browser-sync', 'ngrok', gulp.parallel('psi-mobile', 'psi-desktop'), function disconnect(done) {
    ngrok.disconnect(site);
    done();
    process.exit();
}));

gulp.task('clean', function(done) {
    fs.remove('dist', function(err) {
        if (err) {
            console.error(err);
        }
        done();
    });
});

gulp.task('build', gulp.series('assets', 'build-useref'));
gulp.task('serve', gulp.series('build', 'browser-sync', 'ngrok'));
