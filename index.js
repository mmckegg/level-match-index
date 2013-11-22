var extend = require('./lib/extend')
var hashObject = require('./lib/hash_object')

module.exports = function(db, options){
  extend(db)

  var indexHash = hashObject([options.match, options.index], 'djb2')
  db.matchIndex.add(indexHash, options)

  var result = function(_arguments){
    return new Index(db, indexHash, Array.prototype.slice.call(arguments, 0), options)
  }

  result.rebuild = function(cb){
    db.matchIndex.rebuildIndex(indexHash, cb)
  }

  return result
}

function Index(db, indexHash, args, options){
  this.db = db
  this.options = options
  this.single = options.single
  this.query = hasQuery(args)
  this.args = args
  this.indexHash = indexHash
}

Index.prototype.read = function(opts){
  return this.db.matchIndex.read(this.indexHash, this.args, opts)
}

Index.prototype.watch = function(opts, cb){
  return this.db.matchIndex.watch(this.indexHash, this.args, opts, cb)
}

Index.prototype.getMatcher = function(options){
  var matcher = {}
  if (this.single){
    matcher.item = options.key
  } else  {
    matcher.item = options.key + '[id={.id}]'
    matcher.collection = options.key
    matcher.match = {}
  }

  matcher.match = {}
  var match = this.options.match || {}
  var index = this.options.index || []

  for (var key in match){
    if (key in match){
      matcher.match[key] = match[key]
    }
  }
  for (var i=0;i<index.length;i++){
    matcher.match[index[i]] = this.args[i]
  }

  return matcher
}

function hasQuery(args){
  for (var i=0;i<args.length;i++){
    if (args[i] && args[i].$query){
      return true
    }
  }
}