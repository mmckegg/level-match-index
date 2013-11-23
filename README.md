level-match-index
===

Index and filter LevelDB databases and watch for future changes.

## Example

Set up the view indexes and filters:

```js

var Index = require('level-match-index')
var level = require('level')
var sub = require('level-sublevel')

var db = sub(level('database', {valueEncoding: 'json'}))

var views = {
  
  post: Index(db, {
    match: { type: 'post' },
    index: [ 'id' ],
    single: true
  }),

  postsByTag: Index(db, {
    match: { type: 'post' },
    index: [ {many: 'tags'} ] // index each tag in array seperately
  }),

  commentsByPost: Index(db, {
    match: { type: 'comment' },
    index: [ 'postId' ]
  })

}

```

Add some data:

```
var post1 = {
  id: 'post-1', // used for matching as specified above
  type: 'post', //
  title: 'Typical Blog Post Example',
  tags: [ 'test post', 'long winded' ],
  body: 'etc...',
  date: Date.now()
}

var post2 = {
  id: 'post-2',
  type: 'post',
  title: 'Typical Blog Post Example',
  tags: [ 'test post', 'exciting' ],
  body: 'etc...',
  date: Date.now()
}

var comment1 = {
  id: 'comment-1',
  type: 'comment', // used for matching as specified above
  postId: post1.id, //
  name: 'Matt McKegg',
  body: 'cool story bro',
  date: Date.now()
}

var comment2 = {
  id: 'comment-2',
  type: 'comment', 
  postId: post1.id, 
  name: 'Joe Blogs',
  body: 'I do not understand!',
  date: Date.now()
}

db.batch([
  {key: post1.id, value: post1, type: 'put'},
  {key: post2.id, value: post2, type: 'put'},
  {key: comment1.id, value: comment1, type: 'put'},
  {key: comment2.id, value: comment2, type: 'put'}
])
```

Now query the views:

```js
var result = {post: null, comments: []}

views.post(post1.id).read().on('data', function(data){
  result.post = data.value
}).on('end', getComments)

function getComments(){
  views.commentsByPost(post1.id).read().on('data', function(data){
    result.comments.push(data.value)
  }).on('end', finish)
}

function finish(){
  t.deepEqual(result, {
    post: post1,
    comments: [ comment1, comment2 ]
  })
}
```

Or by tags: 

```js
var posts = []
views.postsByTag('long winded').read().on('data', function(data){
  tags.push(data.value)
}).on('end', finish)

function finish(){
  t.deepEqual(posts, [ post1 ])
}
```

Watch for future changes:

```js
var comment3 = {
  id: 'comment-2',
  type: 'comment', // used for matching as specified above
  postId: post1.id, //
  name: 'Bobby',
  body: 'Done yet?',
  date: Date.now()
}

var remove = views.commentsByPost(post1.id).watch(function(ch){
  // function is called with each change
  t.deepEqual(ch.value, comment3)
})

db.put(newComment.id, newComment)

// remove the watcher hook if no longer needed
remove()
```

### Query params

Same example as above but instead of specifying the postId for comments index, pull it out using a query:

```js
var result = {post: null, comments: []}

views.post(post1.id).read().on('data', function(data){
  result.post = data.value
}).on('end', getComments)

function getComments(){
  // specify a value to extract as query and specify where to get it from as read option
  views.commentsByPost({ $query: 'post.id' }).read({ 
    data: result 
  }).on('data', function(data){
    result.comments.push(data.value)
  }).on('end', finish)
}

function finish(){
  t.deepEqual(result, {
    post: post1,
    comments: [ comment1, comment2 ]
  })
}
```
