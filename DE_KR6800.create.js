var fs = require('fs');

fs.readFile('./DE_KR6800.dict.txt', (err, data) => {
  if (err) {console.log(err);throw err;}
  var dict = {};
//  console.log(data.toString().length);
  var lines = data.toString().split('\n');
  console.log(lines.length)
  for(var i=0;i <lines.length;i++)
  {
      var line = lines[i].split(';');
      var displayForm = line[0].trim();
      var key = displayForm.toLocaleLowerCase();
      var tranlation=line[1].trim();
      dict[key] = {displayForm:displayForm,translation:tranlation};
  }
  write2File(dict,'DE_KR6800',function(err){
  if (err) throw err;
    
  })
});

function write2File(list,fileName,callback){
  fs.writeFile('./'+fileName+'.js', JSON.stringify(list), (err) => {
    if (err) callback(err);
    console.log('The file has been saved!:',fileName);
    callback(null);
  });
}
