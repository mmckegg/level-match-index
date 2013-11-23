module.exports = function(object, keys){

  var manys = getManys(object, keys)

  var results = []
  for (var pos={};pos;pos=incr(pos, manys)){
    var result = []
    for (var i=0;i<keys.length;i++){
      if (manys[i]){
        result[i] = manys[i][pos[i] || 0]
      } else {
        result[i] = object[keys[i]]
      }
    }
    results.push(result)
  }

  return results
}

function getManys(object, keys){
  var manys = {}
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] && typeof keys[i] === 'object' && keys[i].many){
      var key = keys[i].many
      var values = object[key]
      if (Array.isArray(values) && values.length){
        manys[i] = values
      }
    }
  }
  return manys
}

function incr(position, manys){
  for (var i in manys){
    if (i in manys){
      var pos = (position[i] || 0) + 1
      if (pos < manys[i].length){
        position[i] = pos
        return position
      } else {
        position[i] = 0
      }
    }
  }
  return false
}