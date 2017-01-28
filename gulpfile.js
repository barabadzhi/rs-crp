'use strict';

const gulp = require('gulp');
const fs = require('fs-extra');
const zlib = require('zlib');

const browserSync = require('browser-sync');
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

gulp.task('build-static', function(done) {
    fs.remove('dist', function(err) {
        if (err) {
            console.error(err);
        }
        fs.ensureDirSync('dist/assets/');
        fs.copy('src/img/', 'dist/assets/', function(err) {
            if (err) {
                console.error(err);
            }
            fs.remove('dist/assets/.gitignore', function(err) {
                if (err) {
                    console.error(err);
                }
                done();
            });
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
            removeStyleTags: false
        })))
        .pipe(gulpif('*.html', htmlmin({
            collapseWhitespace: true,
            removeComments: true
        })))
        .pipe(gulp.dest('dist'));
});

gulp.task('build-compress', function(done) {
    function compress(filename) {
        return new Promise(function(resolve, reject) {
            let gz = zlib.createGzip({
                level: 9
            });
            let input = fs.createReadStream(filename);
            let output = fs.createWriteStream(filename + '.gz');

            input.pipe(gz).pipe(output);
            output.on('finish', function() {
                removeFile(filename);
                resolve();
            });
        });
    }

    function removeFile(filename) {
        fs.remove(filename, function(err) {
            if (err) {
                console.error(err);
            }
        });
    }

    fs.readdir('dist', function(err, files) {
        let tasks = [];

        files.forEach(function(filename) {
            filename = 'dist/' + filename;
            if (fs.lstatSync(filename).isFile()) {
                tasks.push(compress(filename));
            }
        });

        fs.readdir('dist/assets', function(err, files) {
            files.forEach(function(filename) {
                filename = 'dist/assets/' + filename;
                if (fs.lstatSync(filename).isFile()) {
                    tasks.push(compress(filename));
                }
            });

            Promise.all(tasks).then(done());
        });
    });
});

gulp.task('browser-sync', function(done) {
    browserSync({
        port,
        open: false,
        server: 'dist',
        files: ['dist/*.html', 'dist/assets/*.jpg'],
    }, function(err, bs) {
        bs.addMiddleware('*', require('connect-gzip-static')('dist', {
            maxAge: 2629000000 // one week
        }), {
            override: true
        });
        done();
    });
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

gulp.task('build', gulp.series('build-static', 'build-useref', 'build-compress'));
gulp.task('serve', gulp.series('build', 'browser-sync', 'ngrok'));
