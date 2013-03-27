Match Index for LevelDB
===

Index and filter your database objects in the way they will be rendered using matchers.

Follows the [JSON Context](https://github.com/mmckegg/json-context) [matcher pattern](https://github.com/mmckegg/json-context#matchers) allowing datasources to automatically be generated from matchers, then watch for realtime changes.

It is used internally by [ContextDB](https://github.com/mmckegg/contextdb) for the matcher indexing.

## Installation

```shell
$ npm install level-match-index
```

## Example

This module must be used with [LevelUP](https://github.com/rvagg/node-levelup) and [level-sublevel](https://github.com/dominictarr/level-sublevel).

```js
var LevelUp = require('levelup')
var Sublevel = require('level-sublevel')
var MatchIndex = require('level-match-index')

var db = Sublevel(LevelUp('/tmp/database-name', {
  encoding: 'json' // need to use json encoding for indexing to work
}))
```

Now lets specify some indexes. Decide what attributes you want to query your objects by, and what attributes to filter by. You can use any filter supported by [JSON Filter](https://github.com/mmckegg/json-filter).

```js
var indexes = [
  { $name: 'one_post',
    type: 'post',       // there is nothing special about type or id, any
    id: {$index: true}  //    attribute may be specified here
  },
  { $name: 'many_comments',
    type: 'comment',
    postId: {$index: true}
  }
]

var matchDb = MatchIndex(db, indexes)
```

Now if we put objects into our `db` instance, they will automatically be indexed based on above.

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

  var result = { currentPage: null, comments: [] }

  matchDb.createMatchStream([

    // we must specify the $name and *all* attributes we marked with $index
    {$name: 'one_post', id: postId},
    {$name: 'many_comments', postId: postId}

  ], { tail: false }).on('data', function(data){

    // save the data somewhere useful
    if (data.value.type === 'post'){
      result.currentPage = data.value
    } else if (data.value.type === 'comment'){
      result.comments.push(data.value)
    }

  }).on('end', function(){

    cb(null, result)

  })
}


getPageContext('post-1', function(err, result){
  var html = renderer.render('blog-post', result)
  req.end(html)
})
```

## API

### require('level-match-map')(db, indexes)

Specify a sublevel extended `db` and an array of indexes. An instance of **matchDb** will be returned. 

If the indexes have changed since last time, all objects in `db` will be re-indexed.

### matchDb.lookupIndex($name)

Returns the original index object as passed in that matches specified `$name`.

### matchDb.createMatchStream(matchers, options)

Returns a [level-live-stream](https://github.com/dominictarr/level-live-stream) emitting a `sync` event when all current data has been emitted. Call `end` to stop receiving realtime updates, or specify `tail: false` in `options` to cause the stream to automatically close once synced.

**Options**:

- **tail**: defaults to true. Whether to close stream once all current data has been emitted or continue to get live updates.
- **deletedSince**: Objects with the key `_deleted: true` are not included in the stream by default. Use deletedSince with ms timestamp to access these.

### matchDb.forceIndex()

Force the database to re-index all objects. Shouldn't be necessary, as this should happen automatically as needed.

## Indexes

Indexes can only be specified at initialization, and from then on only referred to by `$name`. If a database is later initialized with changed indexes, the database will automatically re-index.

You can mark as many attributes with {$index: true}, but all must be specified when calling `createMatchStream`. The other attributes are checked using [JSON Filter](https://github.com/mmckegg/json-filter) to see if the object should be included in the index.
