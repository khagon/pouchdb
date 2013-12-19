'use strict';

var testUtils = {};

testUtils.PERSIST_DATABASES = false;

testUtils.couchHost = function() {
  if (typeof module !== 'undefined' && module.exports) {
    return process.env.COUCH_HOST || 'http://localhost:5984';
  }
  // In the browser we default to the CORS server, in future will change
  return 'http://localhost:2020';
}

testUtils.makeBlob = function(data, type) {
  if (typeof module !== 'undefined' && module.exports) {
    return new Buffer(data);
  } else {
    return new Blob([data], {type: type});
  }
}

testUtils.readBlob = function(blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString());
  } else {
    var reader = new FileReader();
    reader.onloadend = function(e) {
      callback(this.result);
    };
    reader.readAsBinaryString(blob);
  }
}

testUtils.base64Blob = function(blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString('base64'));
  } else {
    var reader = new FileReader();
    reader.onloadend = function(e) {
      var base64 = this.result.replace(/data:.*;base64,/, '');
      callback(base64);
    };
    reader.readAsDataURL(blob);
  }
}

// Put doc after prevRev (so that doc is a child of prevDoc
// in rev_tree). Doc must have _rev. If prevRev is not specified
// just insert doc with correct _rev (new_edits=false!)
testUtils.putAfter = function(db, doc, prevRev, callback){
  var newDoc = PouchDB.extend({}, doc);
  if (!prevRev) {
    db.put(newDoc, {new_edits: false}, callback);
    return;
  }
  newDoc._revisions = {
    start: +newDoc._rev.split('-')[0],
    ids: [
      newDoc._rev.split('-')[1],
      prevRev.split('-')[1]
    ]
  };
  db.put(newDoc, {new_edits: false}, callback);
}

// docs will be inserted one after another
// starting from root
testUtils.putBranch = function(db, docs, callback) {
  function insert(i) {
    var doc = docs[i];
    var prev = i > 0 ? docs[i-1]._rev : null;
    function next() {
      if (i < docs.length - 1) {
        insert(i+1);
      } else {
        callback();
      }
    }
    db.get(doc._id, {rev: doc._rev}, function(err, ok){
      if(err){
        testUtils.putAfter(db, docs[i], prev, function(err, doc) {
          next();
        });
      }else{
        next();
      }
    });
  }
  insert(0);
};


testUtils.putTree = function(db, tree, callback) {
  function insert(i) {
    var branch = tree[i];
    testUtils.putBranch(db, branch, function() {
      if (i < tree.length - 1) {
        insert(i+1);
      } else {
        callback();
      }
    });
  }
  insert(0);
};

testUtils.writeDocs = function(db, docs, callback, res) {
  if (!res) {
    res = [];
  }
  if (!docs.length) {
    return callback(null, res);
  }
  var doc = docs.shift();
  db.put(doc, function(err, info) {
    ok(info && info.ok, 'docwrite returned ok');
    res.push(info);
    testUtils.writeDocs(db, docs, callback, res);
  });
};


// Borrowed from: http://stackoverflow.com/a/840849
testUtils.eliminateDuplicates = function(arr) {
  var i, element,
      len = arr.length,
      out = [],
      obj = {};

  for (i=0; i<len; i++) {
    obj[arr[i]]=0;
  }

  for (element in obj) {
    out.push(element);
  }

  return out;
}

// ---- CORS Specific Utils ---- //
//enable CORS on server
testUtils.enableCORS = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({url: host + '_config/httpd/enable_cors', json: false,
    method: 'PUT', body: '"true"'}, function(err, resBody, req) {
      PouchDB.ajax({url: host + '_config/cors/origins', json: false,
        method: 'PUT', body: '"http://127.0.0.1:8000"'}, function(err, resBody, req) {
          callback(err, req);
      });
  });
}

//enable CORS Credentials on server
testUtils.enableCORSCredentials = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({url: host + '_config/cors/credentials',
    method: 'PUT', body: '"true"', json: false}, function(err, resBody, req) {
      callback(err, req);
  });
}

//disable CORS
testUtils.disableCORS = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({
    url: host + '_config/cors/origins',
    json: false,
    method: 'PUT',
    body: '"*"'
  }, function (err, resBody, req) {
    PouchDB.ajax({
      url: host + '_config/httpd/enable_cors',
      json: false,
      method: 'PUT',
      body: '"false"'
    }, function (err, resBody, req) {
      callback(err, req);
    });
  });
}

//disable CORS Credentials
testUtils.disableCORSCredentials = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({
    url: host + '_config/cors/credentials',
    method: 'PUT',
    body: '"false"',
    json: false
  }, function (err, resBody, req) {
    callback(err, req);
  });
}

//create admin user and member user
testUtils.setupAdminAndMemberConfig = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({url: host + '_users/org.couchdb.user:TestUser',
    method: 'PUT', body: {_id: 'org.couchdb.user:TestUser', name: 'TestUser',
    password: 'user', roles: [], type: 'user'}}, function(err, resBody, req) {
      PouchDB.ajax({url: host + '_config/admins/TestAdmin', json: false,
        method: 'PUT', body: '"admin"'}, function(err, resBody, req) {
          callback(err, req);
      });
  });
}

//delete admin and member user
testUtils.tearDownAdminAndMemberConfig = function(dburl, callback) {
  var host = 'http://' + dburl.split('/')[2] + '/';
  var headers = {};
  var token = btoa('TestAdmin:admin');
  headers.Authorization = 'Basic ' + token;
  PouchDB.ajax({url: host + '_config/admins/TestAdmin',
    method: 'DELETE', headers:headers , json: false}, function(err, resBody, req) {
      PouchDB.ajax({url: host + '_users/org.couchdb.user:TestUser',
        method: 'GET', body: '"admin"'}, function(err, resBody, req) {
          if (resBody) {
            PouchDB.ajax({url: host + '_users/org.couchdb.user:TestUser?rev=' + resBody['_rev'],
              method: 'DELETE', json: false}, function(err, resBody, req) {
                callback(err, req);
            });
          } else {
            callback(err, req);
          }
      });
  });
}

testUtils.deleteCookieAuth = function(dburl, callback_) {
  var host = 'http://' + dburl.split('/')[2] + '/';

  PouchDB.ajax({
    method: 'DELETE',
    url: host + '_session',
    withCredentials: true,
    json: false
  }, callback_);
}

testUtils.cleanUpCors = function(dburl, callback_) {
  if (testUtils.PERSIST_DATABASES) {
    return;
  }

  if (typeof module !== 'undefined' && module.exports) {
    disableCORS(dburl, function() {
      PouchDB.destroy(dburl, callback_);
    });
  } else {
    disableCORS(dburl.replace('5984','2020'), function() {
      PouchDB.destroy(dburl.replace('5984','2020'), callback_);
    });
  }
}

testUtils.cleanDbs = function(QUnit, dbs) {
  return function() {
    QUnit.stop();
    var deleted = 0;
    function done() {
      deleted++;
      if (deleted === dbs.length) {
        QUnit.start();
      }
    }
    dbs.forEach(function(db) {
      PouchDB.destroy(db, done);
    });
  }
}

testUtils.loadScript = function(url) {
  var script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);
}

// Thanks to http://engineeredweb.com/blog/simple-async-javascript-loader/
testUtils.asyncLoadScript = function(url, callback) {

  // Create a new script and setup the basics.
  var script = document.createElement("script"),
  firstScript = document.getElementsByTagName('script')[0];

  script.async = true;
  var script = document.createElement("script");

  // Handle the case where an optional callback was passed in.
  if ("function" === typeof(callback)) {
    script.onload = function() {
      callback();
      // Clear it out to avoid getting called more than once or any memory leaks.
      script.onload = script.onreadystatechange = undefined;
    };
    script.onreadystatechange = function() {
      if ("loaded" === script.readyState || "complete" === script.readyState) {
        script.onload();
      }
    };
  }

  // Attach the script tag to the page (before the first script) so the
  // magic can happen.
  firstScript.parentNode.insertBefore(script, firstScript);
}

testUtils.asyncParForEach = function(array, fn, callback) {
  if (array.length === 0) {
    callback(); // done immediately
    return;
  }
  var toLoad = array.shift();
  fn(toLoad, function() {
    testUtils.asyncParForEach(array, fn, callback);
  });
};

testUtils.JSONToURL = function(obj) {
  var str = [];
  for(var p in obj) {
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
    }
  }
  return '?' + str.join('&');
};

testUtils.URLToJSON = function(str) {
  var obj = {};
  str.substr(1).split('&').forEach(function(p) {
    var x = p.split('=');
    obj[decodeURIComponent(x[0])] = decodeURIComponent(x[1]);
  });
  return obj;
};

testUtils.args = function(key) {

  if (typeof process !== 'undefined' && process.env && key in process.env) {
    return process.env[key];
  }

  if (typeof document !== 'undefined') {
    var args = testUtils.URLToJSON(document.location.search);
    if (key in args) {
      return args[key];
    }
  }

  return false;
};

if (typeof module !== 'undefined' && module.exports) {
  var PouchDB = require('../lib/');
  module.exports = testUtils;
}
