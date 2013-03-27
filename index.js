var Trigger = require('level-trigger')
var LiveStream = require('level-live-stream')
var MultiStream = require('./multi_stream')

var checkFilter = require('json-filter')
var hashObject = require('./hash_object')


module.exports = function(db, indexes){
  var self = db.sublevel('match-map')
  var matcher = db.sublevel('matched')

  db.matchMap = self

  // extract params
  var indexLookup = {}
  var indexParams = {}
  var indexHashes = {}

  indexes.forEach(function(index){
    indexLookup[index.$name] = index
    indexParams[index.$name] = paramify(index)
    indexHashes[index.$name] = hashObject(index, 'djb2')
  })

  // map trigger
  var matchTrigger = Trigger(db, 'match', function(id, done){    
    matcher.get('o~' + id, function(err, oldKeys){
      oldKeys = oldKeys || []
      var newKeys = []

      db.get(id, function(err, value){
        var batch = []

        indexes.forEach(function(index){
          var paramifiedMatch = indexParams[index.$name]
          if (checkMatch(value, paramifiedMatch.ensure)){

            var paramHash = hashObjectKeys(value, paramifiedMatch.params)
            var key = indexHashes[index.$name] + '~' + paramHash + '~'

            if (value._deleted && !value._tombstone){
              key += 'd~' + alphaKey(value.deleted_at || Date.now(), 8) + '~'
            } else {
              key += 'c~'
            }

            key += id

            batch.push({key: key, value: value, type: 'put'})
            newKeys.push(key)
          }
        })

        oldKeys.forEach(function (k) {
          if(!~newKeys.indexOf(k)) batch.push({key: k, type: 'del'})
        })

        batch.push({
          key: 'o~' + id,
          value: newKeys,
          type: 'put',
          prefix: matcher
        })

        self.batch(batch, done)
      })
    })
  })

  // check for reindex
  matcher.get('matcher-hashes', function(err, value){
    var currentHashes = Object.keys(indexHashes).map(function(key){
      return indexHashes[key]
    }).sort()
  
    if (!value || value.join('~') !== currentHashes.join('~')){
      process.nextTick(function(){
        self.forceIndex()
        matcher.put('matcher-hashes', currentHashes)
      })
    }
  })

  self.forceIndex = function (){
    matchTrigger.start()
    self.emit('reindex')
    return self
  }

  self.lookupMatcher = function ($name){
    return indexLookup[$name]
  }

  self.createMatchStream = function(matchers, opts){

    if (!Array.isArray(matchers)){
      matchers = [matchers]
    }

    // merge streams together
    return MultiStream(matchers.map(function(matcher){

      if (!matcher.$name) throw new Error('must specify $name')
      if (!indexHashes[matcher.$name]) throw new Error('cannot find specified index')

      var paramifiedIndex = indexParams[matcher.$name]

      opts = opts || {}
      opts.start = indexHashes[matcher.$name] + '~'
      opts.start += hashObjectKeys(matcher, paramifiedIndex.params) + '~'
      
      if (opts.deletedSince){
        opts.start += 'd~' + alphaKey(opts.deletedSince, 8) + '~'
        opts.end = opts.start + 'd~~'
      } else {
        opts.start += 'c~'
        opts.end = opts.start + '~'
      }

      return LiveStream(self, opts)

    }))
  }

  return self
}

function checkMatch(object, ensure){
  return !Object.keys(ensure).length || checkFilter(object, ensure, {match: 'filter'})
}

function hashObjectKeys(object, keys){
  var objectToHash = keys.reduce(function(result, key){
    result[key] = object[key]
    return result
  }, {})
  return hashObject(objectToHash)
}

function alphaKey(number, pad) {
  var N = Math.pow(36, pad);
  return number < N ? ((N + number).toString(36)).slice(1) : "" + number.toString(36)
}
function parseAlphaKey(string){
  return parseInt(string, 36)
}

function paramify(index){
  var params = []
  var ensure = {}

  Object.keys(index).forEach(function(key){
    if (key !== '$name'){
      var value = index[key]
      if (isParam(value)){
        params.push(key)
      } else {
        ensure[key] = value
      }
    }
  })

  return {
    params: params,
    ensure: ensure
  }
}


function isParam(object){
  return object instanceof Object && object.$index
}