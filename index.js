var extend = require('./lib/extend')
var hashObject = require('./lib/hash_object')

module.exports = function(db, options){
  extend(db)

  var indexHash = hashObject([options.match, options.index], 'djb2')
  db.matchIndex.add(indexHash, options)

  return function(_arguments){
    new Index(db, indexHash, Array.prototype.slice.call(arguments, 0), options)
  }
}

function Index(db, indexHash, args, options){
  this.options = options
  this.db = options.db
  this.single = options.single
  this.query = hasQuery(args)
  this.args = args
  this.indexHash = indexHash
}

Index.prototype.read = function(opts){
  return this.db.matchIndex.read(this.indexHash, opts)
}

Index.prototype.watch = function(opts, cb){
  return this.db.matchIndex.watch(this.indexHash, this.args, opts, cb)
}

Index.prototype.getMatcher = function(options){
  //TODO
}