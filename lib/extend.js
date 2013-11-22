var bytewise = require('bytewise/hex')
var through = require('through')
var checkFilter = require('json-filter')

module.exports = function(db){
  if (!db.matchIndex){

    var indexDb = db.sublevel('match-index')
    var matchDb = db.sublevel('match-index-matched')

    var views = {}

    var matchIndex = {
      add: function(id, view, cb){
        views[id] = view
        checkIndex(id, cb)
      },
      read: function(id, args, opts){
        var range = getRange(id, args, opts)
        return indexDb.createReadStream(range).pipe(Get())
      },
      rebuildIndex: function(id, cb){
        matchDb.put('index-' + id, false, function(){
          checkIndex(id, cb)
        })
      },
      watch: function(id, args, opts, cb){
        if (!cb && typeof opts === 'function'){
          cb = opts
          opts = null
        }
        return indexDb.post(getRange(id, args, opts), function(ch){
          if (ch.type === 'put'){
            resolve(ch, cb)
          }
        })
      }
    }

    db.matchIndex = matchIndex

    db.pre(function(change, add){

      for (var id in views){
        if (id in views){
          var view = views[id]
          if (checkMatch(change.value, view.match)){
            var key = generateIndexKey(id, view, change)
            add({ type: 'put', key: key, value: change.key, prefix: indexDb })
          }
        }
      }

    })

    function resolve(data, cb){
      var self = this
      var keys = bytewise.decode(data.key)
      var view = views[keys[0]]
      var args = keys[1]

      var key = data.value
      db.get(key, function(err, value){
        if (!err && checkMatch(value, view.match) && checkArgs(args, value, view.index)){
          cb({key: key, value: value})
        } else {
          indexDb.del(data.key)
          cb(false)
        }
      })
    }

    function Get(){
      var count = 0
      var ended = false
      var sentEnd = false

      function wr(data){
        var self = this
        count += 1
        resolve(data, function(result){
          if (result) self.queue(result)
          count -= 1
          if (!count && ended && !sentEnd){
            self.queue(null)
            sentEnd = true
          }
        })
      }

      function end(){
        if (count){
          ended = true
        } else {
          this.queue(null)
          ended = true
          sentEnd = true
        }
      }

      return through(wr, end)
    }

    function checkIndex(id, cb){
      var view = views[id]
      matchDb.get('index-' + id, function(err, value){
        if (!value){
          db.createReadStream().on('data', function(change){
            if (checkMatch(change.value, view.match)){
              var key = generateIndexKey(id, view, change)
              indexDb.put(key, change.key)
            }
          }).on('end', function(){
            matchDb.put('index-' + id, true)
            cb&&cb()
          })
        } else {
          cb&&cb()
        }
      })
    }

  }
}

function checkArgs(args, object, index){
  var length = Math.max(args.length, index.length)
  for (var i=0;i<length;i++){
    var arg = args[i]
    var value = object[index[i]]
    if (arg !== value){
      return false
    }
  }
  return true
}

function getRange(viewId, args, opts){
  opts = opts || {}

  var start = [viewId, argsWithParams(args, opts.data)]
  var end = start.slice(0)

  if (opts.deletedSince){
    start[2] = ({deleted: opts.deletedSince})
    end[2] = ({deleted: undefined})
  } else {
    start[2] = true
    end[2] = true
    end[3] = undefined
  }

  opts.start = bytewise.encode(start)
  opts.end = bytewise.encode(end)

  return opts
}

function generateIndexKey(indexId, view, change){
  var key = [indexId, objectFromIndex(change.value, view.index)]

  if (change.value._deleted && !change.value._tombstone){
    key[2] = ({deleted: change.value.deletedAt || Date.now()})
  } else {
    key[2] = true
  }

  key[3] = change.key
  return bytewise.encode(key)
}

function argsWithParams(args, data){
  var result = args.slice(0)
  for (var i=0;i<result.length;i++){
    if (result && result[i].$query){
      result[i] = handleQuery(result[i].$query, data)
    }
  }
  return result
}

function handleQuery(query, data){
  var parts = query.split('.')
  var current = data
  for (var i=0;i<parts.length;i++){
    if (current != null){
      current = current[parts[i]]
    }
  }
  return current
}

function objectFromIndex(object, keys){
  var result = []
  for (var i=0;i<keys.length;i++){
    result.push(object[keys[i]])
  }
  return result
}


function checkMatch(object, ensure){
  return !Object.keys(ensure).length || checkFilter(object, ensure, {match: 'filter'})
}
