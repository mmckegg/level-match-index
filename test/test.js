var connection = require('level')
var Sublevel = require('level-sublevel')
var Index = require('../')

var test = require('tape')
var rimraf = require('rimraf')

var testPath = __dirname + '/test-db'
rimraf(testPath, function(){

  var db = Sublevel(connection(testPath, {
    encoding: 'json'
  }))

  var views = {
    
    post: Index(db, {
      match: { type: 'post' },
      index: [ 'id' ],
      single: true
    }),

    comments: Index(db, {
      match: { type: 'comment' },
      index: [ 'postId' ]
    })

  }

  test('read', function(t){

    t.plan(1)

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
      {key: comment1.id, value: comment1, type: 'put'}
    ], readIndex)

    function readIndex(){

      var postId = 'post-1'
      var result = {post: null, comments: []}

      views.post(postId).read().on('data', function(data){
        result.post = data.value
      }).on('end', getComments)

      function getComments(){
        views.comments(postId).read().on('data', function(data){
          result.comments.push(data.value)
        }).on('end', finish)
      }

      function finish(){
        t.deepEqual(result, {
          post: post,
          comments: [ comment1 ]
        })
      }

    }

  })

  test('watch', function(t){

    t.plan(3)

    var postId = 'post-1'

    var newComment2 = {
      id: 'comment-2',
      type: 'comment', // used for matching as specified above
      postId: postId, //
      name: 'Paul',
      body: 'Super!',
      date: Date.now()
    }

    views.comments(postId).watch(function(ch){
      t.deepEqual(ch.value, newComment2, 'New comment emitted')
    })

    var newPost = {
      id: 'post-2', // used for matching as specified above
      type: 'post', //
      title: 'Another post',
      body: 'etc...',
      date: Date.now()
    }

    var newComment3 = {
      id: 'comment-3',
      type: 'comment', // used for matching as specified above
      postId: newPost.id, //
      name: 'Bobby',
      body: 'Done yet?',
      date: Date.now()
    }

    views.post(newPost.id).watch(function(ch){
      t.deepEqual(ch.value, newPost, 'New post emitted')
    })

    views.comments(newPost.id).watch(function(ch){
      t.deepEqual(ch.value, newComment3, 'Comment for new post emitted')
    })

    db.batch([
      {type: 'put', key: newComment2.id, value: newComment2},
      {type: 'put', key: newPost.id, value: newPost},
      {type: 'put', key: newComment3.id, value: newComment3},
    ])

  })

  test('matcher', function(t){
    t.plan(2)

    var postMatcher = views.post('post-1').getMatcher({key: 'page'})
    t.deepEqual(postMatcher, {
      item: 'page',
      match:{
        type: 'post',
        id: 'post-1'
      }
    })

    var commentMatcher = views.comments('post-1').getMatcher({key: 'comments'})
    t.deepEqual(commentMatcher, {
      item: 'comments[id={.id}]',
      collection: 'comments',
      match:{
        type: 'comment',
        postId: 'post-1'
      }
    })

  })

  test('query args', function(t){
    t.plan(1)

    var postId = 'post-1'
    var result = {post: null, comments: []}

    views.post(postId).read().on('data', function(data){
      result.post = data.value
    }).on('end', getComments)

    function getComments(){
      views.comments({$query: 'post.id'}).read({data: result}).on('data', function(data){
        result.comments.push(data.value)
      }).on('end', finish)
    }

    function finish(){
      t.equal(result.comments.length, 2, 'comments returned')
    }
  })

  test('post index', function(t){
    t.plan(2)

    var nameIndex = Index(db, {
      match: {
        type: 'comment'
      },
      index: [ 'name' ]
    })

    setTimeout(function(){
      nameIndex('Matt McKegg').read().on('data', function(data){
        t.equal(data.key, 'comment-1')
      })

      nameIndex('Bobby').read().on('data', function(data){
        t.equal(data.key, 'comment-3')
      })
    }, 10)
  })

  test('update item', function(t){

    var comment = {
      id: 'comment-update-1',
      type: 'comment', // used for matching as specified above
      postId: 'original', //
      name: 'James',
      body: 'More comments',
      date: Date.now()
    }

    db.put(comment.id, comment, function(){

      views.comments('original').read().on('data', function(data){
        if (data.key === comment.id){
          t.ok(true, 'comment added')
        }
      }).on('end', finish)

    })

    function finish(){
      comment.postId = 'new-post'

      db.put(comment.id, comment, function(){

        views.comments('new-post').read().on('data', function(data){
          if (data.key === comment.id){
            t.ok(true, 'comment moved')
          }
        }).on('end', function(){

          views.comments('original').read().on('data', function(data){
            if (data.key === comment.id){
              t.ok(false, 'comment moved')
            }
          }).on('end', t.end.bind(t))

        })



      })
    }



  })

})