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
    
    user: Index(db, {
      match: { type: 'user' },
      index: [ 'id' ]
    }),

    jobsByUser: Index(db, {
      match: {type: 'job'},
      index: [ {many: 'userIds'} ]
    }),

    jobsByUserAndCategory: Index(db, {
      match: {type: 'job'},
      index: [ {many: 'userIds'}, {many: 'categories'} ]
    })

  }

  test('many clientIds', function(t){

    t.plan(5)

    var matt = {
      id: 'user-1',
      name: 'Matt',
      type: 'user'
    }

    var clive = {
      id: 'user-2',
      name: 'Clive',
      type: 'user'
    }

    var hamish = {
      id: 'user-3',
      name: 'Hamish',
      type: 'user'
    }

    var job1 = {
      id: 'job-1',
      name: "Client and Co",
      userIds: [matt.id],
      type: 'job'
    }

    var job2 = {
      id: 'job-2',
      name: "Client Brothers",
      userIds: [clive.id],
      categories: ["easy", "local"],
      type: 'job'
    }

    var job3 = {
      id: 'job-3',
      name: "Client Corporation",
      categories: ["hard", "international"],
      userIds: [hamish.id, clive.id],
      type: 'job'
    }

    var job4 = {
      id: 'job-4',
      name: "Client Ltd",
      categories: ["hard", "local"],
      userIds: [matt.id, clive.id, hamish.id],
      type: 'job'
    }

    db.batch(puts([matt, clive, hamish, job1, job2, job3, job4]), ready)

    function ready(){

      collect(views.jobsByUser(matt.id).read(), function(jobs){
        t.deepEqual(jobs, [job1, job4])
      })

      collect(views.jobsByUser(clive.id).read(), function(jobs){
        t.deepEqual(jobs, [job2, job3, job4])
      })

      collect(views.jobsByUser(hamish.id).read(), function(jobs){
        t.deepEqual(jobs, [job3, job4])
      })

      collect(views.jobsByUserAndCategory(clive.id, 'hard').read(), function(jobs){
        t.deepEqual(jobs, [job3, job4])
      })

      collect(views.jobsByUserAndCategory(hamish.id, 'international').read(), function(jobs){
        t.deepEqual(jobs, [job3])
      })

    }

  })

})

function collect(stream, cb){
  var result = []
  stream.on('data', function(data){
    result.push(data.value)
  }).on('end', function(){
    cb(result)
  })
}

function puts(items){
  return items.map(function(item){
    return {type: 'put', key: item.id, value: item}
  })
}