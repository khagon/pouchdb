'use strict';

var env = (typeof module !== 'undefined' && module.exports) ? 'node' : 'browser';

if (env === 'node') {
  var testUtils = require('./test.utils.js');
  var testrunner = require('qunit');
  var fs = require('fs');
}

var DB1 = 'test_suite_db1';
var DB2 = 'test_suite_db2';
var HTTP_DB1 = testUtils.couchHost() + '/' + DB1;
var HTTP_DB2 = testUtils.couchHost() + '/' + DB2;

var tests = {
  // Rest are alphabetical, but always want to run setup tests first
  'test.setup.js': 'no_database',
  'test.all_dbs.js': false,
  'test.all_docs.js': true,
  'test.attachments.js': 'two_databases',
  'test.auth_replication.js': false,
  'test.basics.js': true,
  'test.bulk_docs.js': true,
  'test.changes.js': true,
  'test.compaction.js': true,
  'test.cors.js': false,
  'test.conflicts.js': true,
  'test.design_docs.js': true,
  'test.get.js': true,
  'test.gql.js': false, // Plugins untested
  'test.http.js': false,
  'test.issue221.js': true,
  'test.issue915.js': 'local',
  'test.replication.js': 'two_databases',
  'test.revs_diff.js': true,
  'test.slash_id.js': true,
  'test.spatial.js': false, // Plugins untested
  'test.taskqueue.js': true,
  'test.views.js': true,
  'test.uuids.js': true,
};

function generateTestPlan() {

  var filesArg = testUtils.args('TEST_FILES');
  var testFiles = filesArg ? filesArg.split(',') : Object.keys(tests);

  var tmpTests = [];
  testFiles.forEach(function(test) {
    if (tests[test] === true) {
      tmpTests.push({file: test, db1: DB1});
      tmpTests.push({file: test, db1: HTTP_DB1});
    } else if (tests[test] === 'no_database') {
      tmpTests.push({file: test});
    } else if (tests[test] === 'http') {
      tmpTests.push({file: test, db1: HTTP_DB1});
    } else if (tests[test] === 'node' && env === 'node') {
      tmpTests.push({file: test, db1: DB1});
    } else if (tests[test] === 'two_databases') {
      tmpTests.push({file: test, db1: DB1, db2: DB2});
      tmpTests.push({file: test, db1: HTTP_DB1, db2: DB1});
      tmpTests.push({file: test, db1: HTTP_DB1, db2: HTTP_DB2});
      tmpTests.push({file: test, db1: DB1, db2: HTTP_DB1});
    }
  });

  return tmpTests;
}

var log = {
  browser: function(str) {
    var span = document.createElement('span');
    span.innerHTML = str + '<br />';
    document.body.appendChild(span);
  },
  node: function(str) { console.log(str); }
};

var assertions = 0;

var runTest = {
  browser: function(test, callback) {
    var testUrl = './test_runner.html' + testUtils.JSONToURL(test);
    log[env]('# <a href="' + testUrl + '">' + testUrl + '</a>');

    var iframe = document.createElement('iframe');
    iframe.src = testUrl;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    window.addEventListener('tests', function resultHandler(evt) {
      window.removeEventListener('tests', resultHandler);
      document.body.removeChild(iframe);
      var result = JSON.parse(evt.detail);
      if (result.failed === 0) {
        callback(null, result);
      } else {
        callback(result);
      }
    });
  },
  node: function(test, callback) {
    testrunner.run({
      log: {errors: true},
      deps: ['./lib/deps/extend.js', './tests/pouch.shim.js'],
      code: "./lib/adapters/leveldb.js",
      tests: ['./tests/' + test.file]
    }, function(err, result) {
      if (err) {
        callback(err);
      } else {
        callback(null, result);
      }
    });
  }
};

var testsToRun = generateTestPlan(tests);
var count = 0;

log[env]('1..' + testsToRun.length);

function printTest(test) {
  var file = test.file;
  delete test.file;
  return file + ', ' + JSON.stringify(test);
}

(function runTests(err, result) {

  if (!testsToRun.length) {
    log[env]('# ran ' + assertions + ' assertions');
    log[env]('Result: PASS');
    return;
  }

  var test = testsToRun.shift();

  runTest[env](test, function(err, res) {
    if (err) {
      log[env]('not ok ' + (++count) + ' - ' + printTest(test));
      log[env]('Result: FAIL');
      if (env === 'node') {
        process.exit(1);
      }
    } else {
      assertions += res.assertions;
      log[env]('ok ' + (++count) + ' - '  + printTest(test));
      runTests();
    }
  });

})();
