var LevelDB = require('levelup')
var Sublevel = require('level-sublevel')
var MatchIndex = require('../')

var test = require('tap').test
var rimraf = require('rimraf')

var testPath = __dirname + '/test-db'
rimraf(testPath, function(){

  var db = Sublevel(LevelDB(testPath, {
    encoding: 'json'
  }))

  var indexes = [
    { $name: 'one_post',
      type: 'post',
      id: {$index: true}
    },
    { $name: 'many_comments',
      type: 'comment',
      postId: {$index: true}
    }
  ]

  var matchDb = MatchIndex(db, indexes)

  test('items are indexed by param then build simple context', function(t){

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
    ])

    setTimeout(function(){

      var postId = 'post-1'
      var result = {currentPage: null, comments: []}

      matchDb.createMatchStream([

        {$name: 'one_post', id: postId},
        {$name: 'many_comments', postId: postId}

      ], { tail: false }).on('data', function(data){

        if (data.value.type === 'post'){
          result.currentPage = data.value
        } else if (data.value.type === 'comment'){
          result.comments.push(data.value)
        }

        console.log(data)

      }).on('end', function(){

        t.deepEqual(result, {
          currentPage: post,
          comments: [ comment1 ]
        })

      })

    }, 10)

  })

})