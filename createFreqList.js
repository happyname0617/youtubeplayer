var fs = require('fs');

fs.readFile('./freqlist.txt', (err, data) => {
  if (err) throw err;
  var frequencyDE = {};
  var lines = data.toString().split('\n');
  var rank = 1;
  for(var i=0; i<lines.length;i++)
  {
      var line = lines[i].split(' ');
      if(!frequencyDE[line[2].toLocaleLowerCase()])
      {
        frequencyDE[line[2].toLocaleLowerCase()] =  {"rank":rank,"frequency":line[1]};
        rank++;
      }
  }
  
  fs.writeFile('./freqlist.js', JSON.stringify(frequencyDE), (err) => {
  if (err) throw err;
  console.log('The file has been saved!');
    });

});