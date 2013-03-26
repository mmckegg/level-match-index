var LevelDB = require('levelup')
var Sublevel = require('level-sublevel')
var MatchMap = require('../')

var test = require('tap').test
var rimraf = require('rimraf')

var testPath = __dirname + '/test-db'
rimraf(testPath, function(){

  var db = Sublevel(LevelDB(testPath, {
    encoding: 'json'
  }))

  var matchers = [
    { ref: 'post',
      match: {
        type: 'post',
        id: {$param: 'postId'}
      }
    },
    { ref: 'post_comment',
      match: {
        type: 'comment',
        postId: {$param: 'postId'}
      }
    }
  ]

  var matchDb = MatchMap(db, matchers)

  test('items are indexed by param then build simple context', function(t){

    t.plan(3)

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

      var context = {currentPage: null, comments: [], postId: 'post-1'}

      matchDb.createMatchStream('post', {
        params: context, 
        tail: false
      }).on('data', function(data){

        t.deepEqual(data.value, post)
        context.currentPage = data.value

      }).on('end', function(){

        matchDb.createMatchStream('post_comment', {
          params: context, 
          tail: false
        }).on('data', function(data){

          t.deepEqual(data.value, comment1)
          context.comments.push(data.value)

        }).on('end', function(){

          t.deepEqual(context, {
            currentPage: post,
            comments: [ comment1 ],
            postId: 'post-1'
          })

        })
      })

    }, 10)

  })

})