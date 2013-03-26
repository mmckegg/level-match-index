Match Map for LevelDB
===

Index your database objects in the way they will be rendered. Follows the [JSON Context](https://github.com/mmckegg/json-context) [matcher pattern](https://github.com/mmckegg/json-context#matchers) allowing datasources to automatically be generated from matchers, then watch for realtime changes.

It is used internally by [ContextDB](https://github.com/mmckegg/contextdb) for the matcher indexing.

## Installation

```shell
$ npm install level-match-map
```

## Example

This module must be used with [LevelUP](https://github.com/rvagg/node-levelup) and [level-sublevel](https://github.com/dominictarr/level-sublevel).

```js
var LevelUp = require('levelup')
var Sublevel = require('level-sublevel')
var MatchMap = require('level-match-map')

var db = Sublevel(LevelUp('/tmp/database-name', {
  encoding: 'json' // need to use json encoding for indexing to work
}))
```

Now lets specify some matchers and hook into the database.

```js
var matchers = [
  { ref: 'post',
    match: {
      type: 'post',
      id: {$param: 'post_id'}
    }
  },
  { ref: 'post_comment',
    match: {
      type: 'comment',
      postId: {$param: 'post_id'}
    }
  }
]

var matchDb = MatchMap(db, matchers)
```

Now if we put objects into our `db` instance, they will automatically be indexed based on the specified matchers.

```js
var post = {

  id: 'post-1', // used for matching as specified above
  type: 'post', //

  title: 'Typical Blog Post Example',
  body: 'etc...',
  date: Date.now()
}
var comment1 = {
  id: 'comment-1',

  type: 'comment', // used for matching as specified above
  postId: post.id, //

  name: 'Matt McKegg',
  body: 'cool story bro',
  date: Date.now()
}

db.batch([
  {key: post.id, value: post, type: 'put'},
  {key: comment.id, value: comment1, type: 'put'}
])
```

Time to render our page:

```js

function getPageContext(postId, cb){
  var params = { postId: postId }
  var data = {currentPage: null, comments: []}
  matchDb.createMatchStream('post', {
    params: params, 
    tail: false
  }).on('data', function(data){

    data.currentPage = data.value

  }).on('end', function(){

    matchDb.createMatchStream('post', {
      params: params, 
      tail: false
    }).on('data', function(data){

      data.comments.push(data.value)

    }).on('end', function(){
      cb(null, data)
    })
  })
}


getPageContext('post-1', function(err, data){
  var html = renderer.render('blog-post', data)
  req.end(html)
})
```

## API

### require('level-match-map')(db, matchers)

Specify a sublevel extended `db` and an array of matchers. An instance of **matchDb** will be returned. 

If the matchers have changed since last time, all objects in `db` will be re-indexed.

### matchDb.lookupMatcher(ref)

Returns the original matcher object as passed in that matches specified `ref`.

### matchDb.createMatcherStream(matcherRef, options)

Returns a [level-live-stream](https://github.com/dominictarr/level-live-stream) emitting a `sync` event when all current data has been emitted. Call `end` to stop receiving realtime updates, or specify `tail: false` in `options` to cause the stream to automatically close once synced.

**Options**:

- **tail**: defaults to true. Whether to close stream once all current data has been emitted or continue to get live updates.
- **params**: params to be used in query in place of $param in matchers
- **queryHandler**: instead of specifying params, can also specify a function to handle $query in matchers
- **deletedSince**: Objects with the key `_deleted: true` are not included in the stream by default. Use deletedSince with ms timestamp to access these.

### matchDb.forceIndex()

Force the database to re-index all objects. Shouldn't be necessary, as this should happen automatically as needed.

## Matchers

Matchers can only be specified at initialization, and from then on only referred to by the name specified under `ref`. If a database is later initialized with changed matchers, the database will automatically be re-indexed. 

The attributes in `match` are checked using [JSON Filter](https://github.com/mmckegg/json-filter) to see if the object should be matched or not. Attributes that are objects with `$param` or `$query` as an attribute will instead be added to the index.

Matchers work best when used with something like [JSON Context](https://github.com/mmckegg/json-filter) to allow automatic building of contexts that can be streamed to the browser for realtime changes.

