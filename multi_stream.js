var Through = require('through')

module.exports = function(streams, additionalEvents){

  var events = ['end'].concat(additionalEvents)

  if (streams.length === 1){
    return streams[0]
  }

  var output = Through()

  var eventCount = {sync: 0, end: 0}

  streams.forEach(function(stream){
    stream.pipe(output, {end: false})
    output.once('close', function(){
      stream.destroy()
    })
    events.forEach(function(event){
      stream.once(event, function(){
        eventCount[event] = (eventCount[event] || 0) + 1
        if (eventCount[event] >= streams.length){

          if (event === 'end'){
            output.end()
          } else {
            output.emit(event)
          }
        }
      })
    })
  })

  return output
}