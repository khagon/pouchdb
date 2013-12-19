'use strict';

module('Test changes across windows (called by test.changes.js)');

asyncTest('Add a doc', 1, function() {

  var dbname = location.search.match(/[?&]dbname=([^&]+)/);
  var db1 = dbname && decodeURIComponent(dbname[1]);

  new PouchDB(db1, function(err, db) {
    db.post({test: 'somestuff'}, function (err, info) {
      ok(!err, 'saved a doc with post');
      start();
    });
  });
});
