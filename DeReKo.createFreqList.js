var fs = require('fs');

fs.readFile('./DeReKo.original.min.txt', (err, data) => {
  if (err) {console.log(err);throw err;}
  var freqListDE = {};
//  console.log(data.toString().length);
  var lines = data.toString().split('\n');
  console.log(lines.length)
  var maxCount = 7500; //max 100000
  var index=0;
  var insertedCount=0;
  while((index<lines.length)&&(insertedCount<maxCount))
  {
      var line = lines[index].split(/[\s]+/);
      //line[0] word
      //line[1] infinitive
      //line[2] type
      //line[3] frequncy
      var cond3 = /[NN]/.test(line[2]) //is nominative?
      var key = line[0].toLocaleLowerCase()
      var displayForm = cond3?line[0]:line[0].toLocaleLowerCase(); //keep as capital letter when NN, otherwise making it tolowercase
      var cond1 = (/^[a-zA-ZäöüÄÖÜß]+$/i).test(line[0]); //is only german characters?
      var cond2 = freqListDE[key]; //is already exist?
      console.log(line[0],line[1],line[2],line[3])
      console.log(key,cond1,cond2,cond3);
      if(cond1 && !cond2)
      {
        freqListDE[key] =  {"rank":insertedCount+1,displayForm:displayForm,"frequency":0, infinitive:line[1], type:line[2]};
        insertedCount++;
        console.log('in ',freqListDE[key])

      }
      else
      {
        console.log('out',key)
      }
      index++;
  }
  write2File(freqListDE,'DeReKoFreqList7500',function(err){
  if (err) throw err;
    
  })
  //generateForEachLevel(freqListDE);
});

function write2File(list,fileName,callback){
  fs.writeFile('./'+fileName+'.js', JSON.stringify(list), (err) => {
    if (err) callback(err);
    console.log('The file has been saved!:',fileName);
    callback(null);
  });
}
function generateForEachLevel(freqListDE)
{
  var level = {A1:700,A2:1200,B1a:1750,B1b:2200,B2a:2800,B2b:3500,C1:5500,C2:7500};
  var A1={};
  var A2={};
  var B1a={};
  var B1b={};
  var B2a={};
  var B2b={};
  var C1={};
  var C2={};
  var count = 0;
  for(var key in freqListDE)
  {
          count++;
          if(count<=level.A1)
          {
              A1[key] = freqListDE[key];
          }
          else if(count<=level.A2)
          {
              A2[key] = freqListDE[key];
          }
          else if(count<=level.B1a)
          {
              B1a[key] = freqListDE[key];
          }
          else if(count<=level.B1b)
          {
              B1b[key] = freqListDE[key];
          }
          else if(count<=level.B2a)
          {
              B2a[key] = freqListDE[key];
          }
          else if(count<=level.B2b)
          {
              B2b[key] = freqListDE[key];
          }
          else if(count<=level.C1)
          {
              C1[key] = freqListDE[key];
          }
          else if(count<=level.C2)
          {
              C2[key] = freqListDE[key];
          }
  
  }
  
  write2File(A1,'DeReKoFreqList7500_A1');
  write2File(A2,'DeReKoFreqList7500_A2');
  write2File(B1a,'DeReKoFreqList7500_B1a');
  write2File(B1b,'DeReKoFreqList7500_B1b');
  write2File(B2a,'DeReKoFreqList7500_B2a');
  write2File(B2b,'DeReKoFreqList7500_B2b');
  write2File(C1,'DeReKoFreqList7500_C1');
  write2File(C2,'DeReKoFreqList7500_C2');
  

}