var hashObject = require('./hash_object')

module.exports = function(db){
  if (!db.matchIndex){

    var indexDb = db.sublevel('match-index')
    var matchDb = db.sublevel('match-index-matched')

    var views = {}

    var matchIndex = {
      add: function(id, view){
        views[id] = view
      },
      read: function(id, arguments, opts){
        return indexDb.read(getRange(id, arguments, opts))
      },
      watch: function(id, arguments, opts, cb){
        if (!cb && typeof opts === 'function'){
          cb = opts
          opts = null
        }
        return indexDb.post(getRange(id, arguments, opts), cb)
      }
    }

    db.pre(function(change, add){

      matchDb.get('o~' + change.key, function(_, oldKeys){

        oldKeys = oldKeys || []
        var newKeys = []

        for (var id in views){
          if (id in views){
            var view = views[id]

            if (checkMatch(change.value, view.match)){
              var key = generateIndexKey(id, change)
              add({ type: 'put', key: key, value: change.value })
              newKeys.push(key)
            }

          }
        }

        // clean up
        for (var i in oldKeys){
          if(!~newKeys.indexOf(oldKeys[i])) add({key: oldKeys[i], type: 'del'})
        }

        add({
          key: 'o~' + change.key,
          value: newKeys,
          type: 'put',
          prefix: matchDb
        })

      })

    })
  }
}

function getRange(viewId, arguments, opts){
  opts = opts || {}
  opts.start = viewId + '~'
  opts.start += hashObjectWithParams(arguments, opts.data) + '~'
  
  if (opts.deletedSince){
    opts.start += 'd~' + alphaKey(opts.deletedSince, 8) + '~'
    opts.end = opts.start + 'd~~'
  } else {
    opts.start += 'c~'
    opts.end = opts.start + '~'
  }

  return opts
}

function generateIndexKey(indexId, change){
  var key = indexId + '~' + hashObjectFromIndex(change.value, view.index)
  if (change.value._deleted && !change.value._tombstone){
    key += 'd~' + alphaKey(change.value.deleted_at || Date.now(), 8) + '~'
  } else {
    key += 'c~'
  }
  return key + change.key
}

function hashObjectWithParams(arguments, data){
  var result = arguments.slice(0)
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

function hashObjectFromIndex(object, keys){
  var result = []
  for (var i=0;i<keys.length;i++){
    result.push(keys[i])
  }
  return result
}

function alphaKey(number, pad) {
  var N = Math.pow(36, pad);
  return number < N ? ((N + number).toString(36)).slice(1) : "" + number.toString(36)
}
function parseAlphaKey(string){
  return parseInt(string, 36)
}
